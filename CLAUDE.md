# grabdy.com

SaaS that lets businesses upload data (PDF, CSV, DOCX, TXT) and retrieve it contextually via REST API and chatbot. Multi-tenant organizations, packed UUID IDs, vector search, and type-safe APIs.

## Project Structure

- `apps/api` - NestJS backend (@grabdy/api)
- `apps/web` - React frontend (@grabdy/web)
- `packages/contracts` - Shared TypeScript contracts (@grabdy/contracts)
- `packages/common` - Shared utilities and ID system (@grabdy/common)

## Tech Stack

- **Backend**: NestJS, Kysely, PostgreSQL + pgvector
- **Frontend**: React, TanStack Router, MUI v7
- **AI**: OpenAI embeddings (text-embedding-3-small), AI SDK for chat
- **Queues**: BullMQ with Redis
- **Animations**: GSAP + ScrollTrigger for landing page

## Package Manager - CRITICAL

- **ALWAYS use `yarn`. NEVER use `npm`, `pnpm`, or any other package manager.**

## Type Checking During Development

- **Use `npx tsc --noEmit` instead of `yarn build` to check for type errors.**
- Run from the specific app directory:
  - API: `cd apps/api && npx tsc --noEmit`
  - Web: `cd apps/web && npx tsc --noEmit`

## Code Rules

### TypeScript

- **NEVER use `as` for type casting. This is a hard rule with NO exceptions.**
- **NEVER create runtime functions that cast strings to `DbId<T>` or `NonDbId<T>`.** `as` casting to branded ID types is only allowed inside `dbIdSchema()` in `packages/common/src/id.ts` and `packNonDbId()`, `nonDbId()`, `nonDbIdSchema()`, `plainNonDbIdSchema()` in `packages/common/src/non-db-id.ts`.
- **NEVER use `!` (non-null assertion operator).** Handle undefined/null with proper guards or early returns.
- Never use `as any`. Always use proper types.
- **NEVER use `await import()` for dynamic imports.**
- **NEVER use `// eslint-disable-next-line`, `// @ts-ignore`, `// @ts-expect-error`.**
- **NEVER re-export types in application code.** Import directly from the source package.
- Use `satisfies` for type checking without casting.
- **Use `satisfies T[] as const` for typed constant arrays.**

### ID System — Packed UUIDs

- **All entity IDs are custom packed UUIDs** with org ID and entity type embedded.
- **Binary layout (16 bytes):** org(4B) + timestamp(6B) + entity_type(1B) + random(5B)
- **Services generate IDs using `packId('EntityType', orgNumericId)`** from `@grabdy/common`.
- **Every `insertInto(...).values({...})` MUST include an explicit `id: packId(...)` call.**
- **Global entities** (User, AuthToken) use `packId('User', GLOBAL_ORG)` where `GLOBAL_ORG = 0`.
- **Org-scoped entities** extract the org from an existing FK: `packId('Collection', extractOrgNumericId(orgId))`.
- **ALWAYS use `dbIdSchema('Collection')` for DB table ID fields** — validates UUID format AND entity type byte.
- **Use `NonDbId<'CanvasCard'>` and `nonDbIdSchema('CanvasCard')`** for non-table entities (JSONB-stored IDs).
- **Use `packNonDbId('CanvasCard', orgNum)`** to generate non-table packed UUIDs.
- **ESLint rule `enforce-dbid`** requires all `*Id` params to use `DbId<T>` or `NonDbId<T>`. No exceptions.
- **Use `nonDbId<T>(value)` to brand plain strings** as `NonDbId<T>` at trust boundaries (e.g., ReactFlow node IDs, AI-generated IDs).
- **Use `plainNonDbIdSchema<T>()` in Zod schemas** for non-UUID branded IDs (edge keys, component keys).

#### Entity Type Codes

- Org=0x01, User=0x02, OrgMembership=0x03, AuthToken=0x04
- Collection=0x10, DataSource=0x11, Chunk=0x12
- ApiKey=0x20, ChatThread=0x30, CanvasCard=0x31, CanvasEdge=0x32, CanvasComponent=0x33

### Database

- **Use snake_case for all PostgreSQL table and column names.**
- Keep TypeScript model names in PascalCase, field names in camelCase.

### NestJS

- **NEVER make injected services optional.**
- Never use `forwardRef()`. Fix circular dependencies properly.
- **Use `@nestjs/bullmq` for job queues.**

### API Calls (ts-rest) - CRITICAL

- **NEVER use raw `fetch()` in the frontend.**
- **ALWAYS use ts-rest for ALL API calls.**

### NestJS Controllers (ts-rest)

- **ALWAYS use `@ts-rest/nest` for controllers.**

### Drawer System - CRITICAL

- **NEVER use MUI Dialog components.**
- **ALWAYS use the drawer system** via `DrawerProvider` and `useDrawer()`.

### Colors - CRITICAL

- **NEVER use hardcoded hex colors in component code.**
- Use MUI palette paths: `'text.primary'`, `'grey.500'`, etc.

### Data Fetching - CRITICAL

- **ALWAYS do filtering, sorting, and pagination on the server.**

### Simplicity - CRITICAL

- **Delete dead code. Never keep "just in case" code.**
- YAGNI — don't build for hypothetical future requirements.

### File Organization (API)

- **NEVER create index.ts barrel files in the API.**

### File Organization (Frontend)

- **One React component per file.**
- **Group related components in folders** with an `index.ts` barrel export.

### Local Storage

- **All localStorage keys MUST be defined in `apps/web/src/lib/storage-keys.ts`.**

### GSAP Conventions

- Use `gsap.registerPlugin(ScrollTrigger)` at module level.
- All animations MUST respect `prefers-reduced-motion`.
- Use `gsap.context()` for proper cleanup in React `useEffect`.
- Prefer `gsap.from()` for entrance animations.

### API Key Auth

- External API access uses `X-API-Key` header with `gbd_` prefixed keys.
- Cookie auth for dashboard, API key auth for external REST API.

### General

- Do not reinvent the wheel. Use existing libraries.
- **ALWAYS check if a library is already installed before adding a new one.**
- Use icon libraries (lucide-react) instead of inline SVGs.
- **NEVER use browser prompts: `window.alert()`, `window.confirm()`, `window.prompt()`.**

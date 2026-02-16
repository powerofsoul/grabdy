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
- **NEVER use `string` or `number` as `Record` key type.** Always use a typed union (e.g., `Record<ToolName, Display>` not `Record<string, Display>`).
- **NEVER use interfaces with multiple optional keys where the shape depends on the type.** Use discriminated unions instead.

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
- Collection=0x10, DataSource=0x11, Chunk=0x12, ExtractedImage=0x13
- ApiKey=0x20, ChatThread=0x30, CanvasCard=0x31, CanvasEdge=0x32, CanvasComponent=0x33

### Database

- **Use snake_case for all PostgreSQL table and column names.**
- Keep TypeScript model names in PascalCase, field names in camelCase.

### NestJS

- **NEVER make injected services optional.**
- Never use `forwardRef()`. Fix circular dependencies properly.
- **Use `@nestjs/bullmq` for job queues.**
- **NEVER call AI SDK functions (`generateText`, `streamText`, `embed`, `embedMany`) directly.** Always use an injectable service that tracks usage via `AiUsageService`. The only exceptions are inside dedicated service classes (e.g., `ImageExtractor`, `RagSearchTool`) that inject `AiUsageService` and log usage themselves.

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

### Single Source of Truth - CRITICAL

- **Shared constants (file types, enums, schemas) MUST be defined once in `@grabdy/contracts` or `@grabdy/common`.**
- Both frontend and backend import from the shared package. **NEVER duplicate lists of supported file types, MIME types, or enum values** across apps.
- Supported file types are defined in `SUPPORTED_FILE_TYPES` in `packages/contracts/src/enums.ts`. Derived helpers: `SUPPORTED_MIMES`, `SUPPORTED_EXTENSIONS`, `SUPPORTED_LABELS`, `MIME_TO_DATA_SOURCE_TYPE`.

### Simplicity - CRITICAL

- **Delete dead code. Never keep "just in case" code.**
- YAGNI — don't build for hypothetical future requirements.

### File Organization (API)

- **NEVER create index.ts barrel files in the API.**

### File Organization (Frontend)

- **One React component per file. No exceptions.** A `.tsx` file contains exactly one component — no helper components, no constants, no utility functions alongside it.
- **Constants, helper functions, and types go in their own files** (e.g., `constants.ts`, `helpers.ts`, `types.ts`), never inline in a component file.
- **One hook per file.** Each `use*.ts` file exports a single hook.
- **Group related components in folders** with an `index.ts` barrel export.
- **Co-locate hooks, utils, types, and styles next to the components that use them.** Never create top-level `hooks/`, `utils/`, or `types/` directories.
- **`index.ts` exports only the public API** — the main component and any hooks/types that parent modules need. Internal subcomponents stay unexported.

#### Feature Folder Structure

Every feature folder follows this layout — **main component at root, sub-components in `components/`, hooks in `hooks/`**:

```
feature/
├── index.ts              ← barrel export (only public components/hooks)
├── FeatureMain.tsx        ← main orchestrator component
├── types.ts              ← shared types for this feature
├── styles.ts             ← shared styles for this feature
├── components/            ← subcomponents
│   ├── SubComponentA.tsx
│   ├── SubComponentB.tsx
│   └── sub-feature/      ← complex sub-component gets its own folder
│       ├── index.ts
│       ├── SubFeature.tsx
│       ├── constants.ts
│       └── helpers.ts
└── hooks/                 ← hooks used across multiple components
    ├── useSharedHookA.ts
    └── useSharedHookB.ts
```

#### Component Subfolder Rule

**When a component has its own constants, helpers, or types, it MUST live in its own subfolder** with an `index.ts` barrel export:

```
components/
├── simple-component/          ← has constants → gets a folder
│   ├── index.ts
│   ├── SimpleComponent.tsx
│   └── constants.ts
├── PlainComponent.tsx          ← no constants → stays flat
```

- A component with only a `.tsx` file stays flat in the parent directory.
- A component with constants/helpers/types gets its own kebab-case folder.
- The folder's `index.ts` re-exports only the component.
- Constants file is always named `constants.ts` (not `component-name-constants.ts`).
- Helpers file is always named `helpers.ts`, types file `types.ts`.

#### Naming Conventions

- **Folders**: kebab-case (`source-chips/`, `sticky-note/`, `main-table/`)
- **Component files**: PascalCase (`SourceChips.tsx`, `StickyNoteComponent.tsx`)
- **Non-component files**: kebab-case (`constants.ts`, `helpers.ts`, `types.ts`, `parse-blocks.ts`)
- **Hook files**: camelCase with `use` prefix (`useChatStream.ts`, `useCanvasState.ts`)

### Local Storage

- **All localStorage keys MUST be defined in `apps/web/src/lib/storage-keys.ts`.**

### GSAP Conventions

- Use `gsap.registerPlugin(ScrollTrigger)` at module level.
- All animations MUST respect `prefers-reduced-motion`.
- Use `gsap.context()` for proper cleanup in React `useEffect`.
- Prefer `gsap.from()` for entrance animations.

### API Key Auth

- External API access uses `Authorization: Bearer` header with `gbd_` prefixed keys.
- Cookie auth for dashboard, Bearer API key auth for external REST API and MCP.

### General

- Do not reinvent the wheel. Use existing libraries.
- **ALWAYS check if a library is already installed before adding a new one.**
- Use icon libraries (@phosphor-icons/react with weight="light") instead of inline SVGs. **ALWAYS use the `Icon` suffix** (e.g., `TrashIcon` not `Trash`). The non-suffixed names are deprecated.
- **NEVER use browser prompts: `window.alert()`, `window.confirm()`, `window.prompt()`.**

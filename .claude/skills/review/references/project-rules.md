# Project-Specific Rules Checklist

Flag any of these violations in the diff. Each is a CLAUDE.md rule.

## TypeScript

- `as` type casts (use type guards or `satisfies`)
- `!` non-null assertions (use proper guards or early returns)
- `as any` (use proper types)
- `// @ts-ignore`, `// @ts-expect-error`, `// eslint-disable` suppression comments
- `await import()` dynamic imports (use static imports)
- `string` or `number` as `Record` key type (use typed unions)
- `Record<string, unknown>` as a bag of fields (use discriminated unions)
- Interfaces with multiple optional keys where shape depends on type (use discriminated unions)
- Raw `typeof`/`in` operator chains to narrow unknown data (use Zod `.parse()` or `.safeParse()`)

## ID System

- Raw id strings where `DbId<T>` or `NonDbId<T>` should be used
- `insertInto(...).values({...})` without explicit `id: packId(...)` call
- Runtime functions that cast strings to `DbId<T>` or `NonDbId<T>` (only allowed in specific files)

## Frontend

- Raw `fetch()` (must use ts-rest)
- `window.alert()`, `window.confirm()`, `window.prompt()` (use drawer system)
- MUI Dialog components (must use drawer system via `useDrawer()`)
- Hardcoded hex colors (use MUI palette paths like `'text.primary'`, `'grey.500'`)
- Hardcoded localStorage keys (must use `STORAGE_KEYS` from `lib/storage-keys.ts`)
- `useState` + `useEffect` + `useCallback` for API calls (use `useQuery`/`useMutation`)
- `useState` for form fields (use `react-hook-form` with `zodResolver`)
- Frontend filtering/sorting/pagination instead of server-side
- Multiple components in one `.tsx` file (one component per file)
- Hardcoded back-navigation paths (must use `router.history.back()`)

## Backend (NestJS)

- Optional injected services (must be required)
- `forwardRef()` (fix circular dependencies properly)
- Direct AI SDK calls (`generateText`, `streamText`, `embed`, `embedMany`) outside dedicated service classes
- Barrel `index.ts` files in the API
- Controllers catching errors just to re-throw (let `GlobalExceptionFilter` handle it)
- Internal error details exposed in API responses (use generic messages)

## Database

- Modified existing migration files (always create new migrations)
- `db.ts` types imported from contracts (must be inlined, mirror actual schema)
- `unknown` for typed JSONB columns (use inline discriminated unions)
- camelCase table/column names (use snake_case in PostgreSQL)

## General

- Dead code, unused exports, "just in case" code
- Duplicated constants that should be in `@grabdy/contracts` or `@grabdy/common`
- Em dashes anywhere in copy, code, or UI text
- Re-exported types in application code (import directly from source package)

---
name: backend
description: Develop NestJS backend services, controllers, and modules. Enforces Kysely query patterns, packId for IDs, proper error handling, BullMQ for background work, and AI SDK usage tracking. Use when user says "new service", "add module", "backend feature", "create controller", "nestjs", or "add service method".
disable-model-invocation: false
argument-hint: '[task]'
---

# Backend Development

You are an expert backend developer building a multi-tenant NestJS API with Kysely, PostgreSQL, and BullMQ. You enforce strict type safety with branded IDs, contract-first API design, and proper error propagation. Every database operation is org-scoped. Every ID is a packed UUID.

## Before Writing Code

1. Read existing code in the same module to match patterns
2. Consult `references/patterns.md` for controller, service, Kysely, BullMQ, and AI SDK patterns
3. Check `packages/contracts/` for existing contract definitions
4. Check `apps/api/src/db/db.ts` for table schemas

## Critical Rules

- **Every insert MUST use `packId('EntityType', orgId)`** for the `id` field
- **All ID params typed as `DbId<'EntityType'>`**, never raw strings
- **NEVER catch errors in controllers**, let GlobalExceptionFilter handle them
- **NEVER call AI SDK directly** (`generateText`, `embed`), use AiService wrapper
- **NEVER use `as` casting or `!` non-null assertions**
- **NEVER use `forwardRef()`**, fix circular deps properly
- **NEVER make injected services optional**
- **Use BullMQ** for all background/async work via `@InjectTypedQueue`
- **Use Zod schemas at trust boundaries** (JSONB parsing, webhook payloads, external API responses)
- **Use snake_case** for PostgreSQL table/column names, camelCase for TypeScript
- **Use transactions** for multi-table writes

## Workflow

### Step 1: Understand the task

- What service/controller/module is being built?
- What database tables does it touch?
- Does it need background jobs (BullMQ)?
- Does it call AI SDK functions?

### Step 2: Check existing patterns

- Read the module's existing service and controller
- Check the contract for endpoint definitions
- Check db.ts for table schema

### Step 3: Build

- Controller: `@OrgAccess` + `@TsRestHandler` + `tsRestHandler()`
- Service: Kysely queries with `packId()`, `DbId<T>` params, NestJS exceptions
- Processor: `@Processor()` extends `WorkerHost`, `@OnWorkerEvent('failed')`
- Response shape: `{ success: true, data }` or `{ success: false, error }`

### Step 4: Validate

- Every insert has `id: packId()`
- Every query on org-scoped data filters by org (via packed UUID or explicit org_id)
- No `as` casting, no `!`, no `// @ts-ignore`
- Error handling defers to GlobalExceptionFilter
- AI calls go through AiService with usage logging
- Run `cd apps/api && npx tsc --noEmit`

## Troubleshooting

### Circular dependency

Never use `forwardRef()`. Instead, extract shared logic into a separate service or restructure module boundaries.

### Kysely type mismatch

Check that `db.ts` mirrors the actual schema. Column types are inlined, not imported from contracts. Use `Generated<T>` for columns with DB defaults.

### numUpdatedRows check

Kysely returns `bigint` for row counts. Compare with `0n`, not `0`.

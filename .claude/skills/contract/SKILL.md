---
name: contract
description: Build or modify ts-rest API contracts with Zod schemas, path params, and typed responses. Use when user says "new contract", "add schema", "update contract", "api contract", "zod schema", or "add endpoint to contract".
disable-model-invocation: false
argument-hint: '[endpoint description]'
---

# ts-rest Contract Builder

## Step 1: Determine the contract

From `$ARGUMENTS`, identify:

- Which domain contract file to add to (`packages/contracts/src/contracts/`)
- HTTP method and path
- Request body fields and validation rules
- Response shape

Read the existing contract file to match patterns.

## Step 2: Write the Zod schemas

Rules for schemas:

- All string fields: include human-readable error messages (`z.string().min(1, 'Name is required')`)
- ID fields: use `dbIdSchema('EntityType')` from `@grabdy/common`
- Enums: import from shared enums in `packages/contracts/src/enums/`, never inline
- No `Record<string, unknown>`: use typed objects or discriminated unions
- No `as` casting anywhere
- Optional fields: use `.optional()` or `.nullable()` with clear intent

## Step 3: Define the endpoint

```typescript
endpointName: {
  method: 'POST',
  path: '/orgs/:orgId/entities',
  pathParams: z.object({
    orgId: dbIdSchema('Org'),
  }),
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name must be under 100 characters'),
    description: z.string().max(500, 'Description must be under 500 characters').optional(),
  }),
  responses: {
    200: z.object({
      success: z.literal(true),
      data: entityResponseSchema,
    }),
    400: z.object({
      success: z.literal(false),
      error: z.string(),
    }),
  },
}
```

## Step 4: Verify

- Response uses `{ success: true, data }` / `{ success: false, error }` pattern
- Path params with IDs use `dbIdSchema('EntityType')`
- Body schemas have human-readable messages on every validation
- No duplicated enums or constants (import from shared packages)
- Run `npx tsc --noEmit` from `packages/contracts` to verify

## Common patterns

- **List endpoint**: `GET /orgs/:orgId/entities` with query params for pagination (`limit`, `offset`, `sortBy`, `sortOrder`)
- **Get by ID**: `GET /orgs/:orgId/entities/:entityId` with `entityId: dbIdSchema('Entity')`
- **Create**: `POST /orgs/:orgId/entities` with body schema
- **Update**: `PATCH /orgs/:orgId/entities/:entityId` with partial body (`.partial()` or `.pick()`)
- **Delete**: `DELETE /orgs/:orgId/entities/:entityId` with empty body `z.object({})`

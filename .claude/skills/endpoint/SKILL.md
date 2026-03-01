---
name: endpoint
description: Scaffold a full-stack API endpoint, from ts-rest contract to NestJS controller, service, and frontend hook. Use when user says "new endpoint", "add API", "create route", "scaffold endpoint", or "add CRUD for".
disable-model-invocation: false
argument-hint: '[description of the endpoint]'
---

# Full-Stack Endpoint Scaffolder

Generates all layers for a new API endpoint in one pass.

## Step 1: Understand the requirement

From `$ARGUMENTS`, determine:

- Entity name and operation (CRUD, custom action)
- Which fields are needed (request body, response shape)
- Whether it's org-scoped (most are) or global
- Auth requirement (JWT cookie, API key, or public)

## Step 2: Add the contract

File: `packages/contracts/src/contracts/{domain}.contract.ts`

```typescript
endpointName: {
  method: 'POST',
  path: '/orgs/:orgId/{entity}',
  pathParams: z.object({ orgId: dbIdSchema('Org') }),
  body: z.object({
    name: z.string().min(1, 'Name is required'),
  }),
  responses: {
    200: z.object({ success: z.literal(true), data: entitySchema }),
    400: z.object({ success: z.literal(false), error: z.string() }),
  },
}
```

Rules:

- All Zod schemas MUST include human-readable error messages
- ID fields use `dbIdSchema('EntityType')`
- No `Record<string, unknown>`, use typed objects or discriminated unions
- Response format: `{ success: true, data: T }` or `{ success: false, error: string }`
- Enums and constants imported from `@grabdy/contracts` or `@grabdy/common`

## Step 3: Add controller method

File: `apps/api/src/modules/{domain}/{domain}.controller.ts`

```typescript
@OrgAccess(contract.endpointName, { params: ['orgId'] })
@TsRestHandler(contract.endpointName)
async endpointName(@CurrentMembership() membership: JwtMembership) {
  return tsRestHandler(contract.endpointName, async ({ params, body }) => {
    const result = await this.service.method(params.orgId, body);
    return { status: 200 as const, body: { success: true as const, data: result } };
  });
}
```

Rules:

- Use `@OrgAccess()` with `{ params: ['orgId'] }` for org-scoped endpoints
- Use `@TsRestHandler()` + `tsRestHandler()` pattern
- NEVER catch errors, let GlobalExceptionFilter handle them
- Return `status: 200 as const` (literal types)

## Step 4: Add service method

File: `apps/api/src/modules/{domain}/{domain}.service.ts`

```typescript
async create(orgId: DbId<'Org'>, data: { name: string }) {
  const entity = await this.db.kysely
    .insertInto('schema.table_name')
    .values({
      id: packId('EntityType', orgId),
      org_id: orgId,
      name: data.name,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { id: entity.id, name: entity.name, createdAt: entity.created_at };
}
```

Rules:

- Every `insertInto().values()` MUST include `id: packId('EntityType', orgId)`
- All ID params typed as `DbId<'EntityType'>`
- Throw NestJS exceptions (NotFoundException, ConflictException, BadRequestException)
- Use transactions for multi-table writes
- Use snake_case for DB columns, camelCase for return objects

## Step 5: Add frontend hook

File: `apps/web/src/routes/dashboard/{domain}/hooks/use{Action}.ts` or inline in page

```typescript
// Query
const { data, isLoading } = useQuery({
  queryKey: ['{entity}', selectedOrgId],
  queryFn: async () => {
    const res = await api.{domain}.{endpoint}({ params: { orgId: selectedOrgId } });
    if (res.status === 200) return res.body.data;
    return [];
  },
  enabled: !!selectedOrgId,
});

// Mutation
const mutation = useMutation({
  mutationFn: async (data: FormData) => {
    const res = await api.{domain}.{endpoint}({ params: { orgId: selectedOrgId }, body: data });
    if (res.status !== 200) throw new Error('Failed');
    return res.body.data;
  },
  onSuccess: () => {
    toast.success('Created');
    queryClient.invalidateQueries({ queryKey: ['{entity}', selectedOrgId] });
  },
});
```

## Step 6: Update db.ts if needed

If the endpoint touches a new table or column, update `apps/api/src/db/db.ts` to mirror the schema. Use inline types, `DbId<'EntityType'>` for IDs, `Generated<T>` for columns with defaults, and discriminated unions for JSONB.

## Checklist

- Contract has Zod schemas with human-readable messages
- Controller uses `@OrgAccess` + `@TsRestHandler`
- Service uses `packId()` for inserts, `DbId<T>` for ID params
- Frontend uses `useQuery`/`useMutation` with `api` client
- No `as` casting, no `!`, no raw `fetch()`
- Response shape: `{ success: true/false, data/error }`

# Backend Patterns Reference

## Controller Pattern (@ts-rest/nest)

```typescript
import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';
import {
  CurrentMembership,
  JwtMembership,
} from '../../common/decorators/current-membership.decorator';

@Controller()
export class DomainController {
  constructor(private service: DomainService) {}

  @OrgAccess(contract.create, { params: ['orgId'] })
  @TsRestHandler(contract.create)
  async create(@CurrentMembership() membership: JwtMembership) {
    return tsRestHandler(contract.create, async ({ params, body }) => {
      const result = await this.service.create(params.orgId, membership.id, body);
      return { status: 200 as const, body: { success: true as const, data: result } };
    });
  }
}
```

Rules:

- `@OrgAccess()` declares auth requirements, `{ params: ['orgId'] }` for org-scoped
- `@TsRestHandler()` + `tsRestHandler()` for type-safe routing
- NEVER catch errors in controllers, let GlobalExceptionFilter handle them
- Return literal types: `status: 200 as const`, `success: true as const`

## Service Pattern (Kysely)

```typescript
@Injectable()
export class DomainService {
  constructor(private db: DbService) {}

  async create(orgId: DbId<'Org'>, userId: DbId<'User'>, data: { name: string }) {
    const entity = await this.db.kysely
      .insertInto('schema.table_name')
      .values({
        id: packId('EntityType', orgId),
        org_id: orgId,
        name: data.name,
        created_by_id: userId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { id: entity.id, name: entity.name, createdAt: entity.created_at };
  }

  async findById(id: DbId<'Entity'>) {
    const entity = await this.db.kysely
      .selectFrom('schema.table_name')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!entity) throw new NotFoundException('Entity not found');
    return entity;
  }

  async update(id: DbId<'Entity'>, updates: Partial<{ name: string }>) {
    const result = await this.db.kysely
      .updateTable('schema.table_name')
      .set({ ...updates, updated_at: new Date() })
      .where('id', '=', id)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) throw new NotFoundException('Entity not found');
  }

  async delete(id: DbId<'Entity'>) {
    await this.db.kysely.deleteFrom('schema.table_name').where('id', '=', id).executeTakeFirst();
  }
}
```

Rules:

- Every `insertInto().values()` MUST include `id: packId('EntityType', orgId)`
- All ID params typed as `DbId<'EntityType'>`
- Use `executeTakeFirstOrThrow()` for required rows, `executeTakeFirst()` for optional
- Check `result.numUpdatedRows === 0n` for updates (bigint)
- Throw NestJS exceptions: NotFoundException, ConflictException, BadRequestException
- Return camelCase objects (map from snake_case DB columns)

## Transactions

```typescript
const result = await this.db.kysely.transaction().execute(async (trx) => {
  const entity = await trx
    .insertInto('schema.table1')
    .values({ id: packId('Entity1', orgId), ... })
    .returningAll()
    .executeTakeFirstOrThrow();

  await trx
    .insertInto('schema.table2')
    .values({ id: packId('Entity2', orgId), entity1_id: entity.id, ... })
    .execute();

  return entity;
});
```

## Kysely Query Patterns

```typescript
// Join
const results = await this.db.kysely
  .selectFrom('data.collections')
  .innerJoin('data.data_sources', 'data.data_sources.collection_id', 'data.collections.id')
  .select(['data.collections.id', 'data.collections.name', 'data.data_sources.status'])
  .where('data.collections.org_id', '=', orgId)
  .execute();

// Batch IN query
const items = await this.db.kysely
  .selectFrom('data.chunks')
  .selectAll()
  .where('id', 'in', chunkIds)
  .execute();

// Pagination
const items = await this.db.kysely
  .selectFrom('data.collections')
  .selectAll()
  .where('org_id', '=', orgId)
  .orderBy(sortBy, sortOrder)
  .limit(limit)
  .offset(offset)
  .execute();

// Count
const { count } = await this.db.kysely
  .selectFrom('data.collections')
  .select(({ fn }) => fn.count('id').as('count'))
  .where('org_id', '=', orgId)
  .executeTakeFirstOrThrow();
```

## Error Handling

- NEVER expose internal errors to users in production
- Throw NestJS HttpExceptions for client errors
- Throw `UserFacingError` when you want the exact message shown to users
- Everything else is caught by GlobalExceptionFilter and returns "Something went wrong"
- Log full errors server-side: `this.logger.error({ err: exception }, 'Description')`

## BullMQ Producer Pattern

```typescript
@Injectable()
export class DomainService {
  constructor(@InjectTypedQueue('queue-name') private queue: Queue) {}

  async triggerJob(data: JobPayload): void {
    await this.queue.add('job-name', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }
}
```

## AI SDK Usage

NEVER call `generateText`, `streamText`, `embed`, `embedMany` directly. Use `AiService` which wraps calls and logs usage:

```typescript
@Injectable()
export class MyService {
  constructor(private aiService: AiService) {}

  async doAiWork(orgId: DbId<'Org'>, userId: DbId<'User'>) {
    const result = await this.aiService.generateText(
      { model: openai('gpt-4o-mini'), prompt: '...' },
      'gpt-4o-mini',
      'CHAT',
      { orgId, userId, source: 'WEB' }
    );
    return result.text;
  }
}
```

## Auth Decorators

| Decorator                                             | Purpose                                       |
| ----------------------------------------------------- | --------------------------------------------- |
| `@OrgAccess(contract, { params: ['orgId'] })`         | Org-scoped endpoint, validates membership     |
| `@OrgAccess(contract, { roles: ['OWNER', 'ADMIN'] })` | Requires specific roles                       |
| `@Public()`                                           | No auth required (health checks, auth routes) |
| `@CurrentMembership()`                                | Injects JwtMembership (id, roles)             |
| `@CurrentUser()`                                      | Injects full user from JWT                    |

## Module Registration

```typescript
@Module({
  imports: [TypedQueueModule.register('queue-name')],
  controllers: [DomainController],
  providers: [DomainService, DomainProcessor],
  exports: [DomainService],
})
export class DomainModule {}
```

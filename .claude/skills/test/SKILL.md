---
name: test
description: Generate unit and integration tests for services, controllers, or components. Covers happy path, error paths, tenant isolation, and ID validation. Use when user says "write tests", "test this", "add tests for", "test coverage", or "generate tests".
disable-model-invocation: false
argument-hint: '[file or module to test]'
---

# Test Generator

## Step 1: Read the target

Read the file specified in `$ARGUMENTS` and all its dependencies (imported services, types, contracts).

Determine:

- Is this a NestJS service, controller, or React component?
- What are the injectable dependencies to mock?
- What are the key code paths (happy, error, edge cases)?

## Step 2: Plan test cases

For every public method, cover:

1. **Happy path**: Valid input produces expected output
2. **Validation errors**: Invalid input throws or returns error
3. **Not found**: Entity doesn't exist, throws NotFoundException
4. **Conflict**: Duplicate creation throws ConflictException
5. **Tenant isolation**: Cannot access resources from a different org
6. **ID validation**: Packed UUID with wrong entity type byte is rejected by dbIdSchema

For services with database queries:

- Mock `DbService.kysely` with chainable query builders
- Test that `packId()` is called with correct entity type and org

For controllers:

- Test that `@OrgAccess` params are correct
- Test response shape matches contract (`{ success: true, data }`)

For React components:

- Test loading, empty, error, and success states
- Test form validation and submission
- Test that mutations invalidate correct query keys

## Step 3: Write the test file

File: `{target-dir}/{target-name}.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DomainService } from './domain.service';
import { DbService } from '../../db/db.module';

describe('DomainService', () => {
  let service: DomainService;
  let db: jest.Mocked<DbService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DomainService,
        {
          provide: DbService,
          useValue: {
            kysely: createMockKysely(),
          },
        },
      ],
    }).compile();

    service = module.get(DomainService);
    db = module.get(DbService);
  });

  describe('create', () => {
    it('should create entity with packId', async () => {
      // Arrange, Act, Assert
    });

    it('should throw ConflictException on duplicate', async () => {
      // ...
    });
  });
});
```

## Step 4: Verify

Run `npx tsc --noEmit` from the app directory to ensure tests compile.

## Rules

- Use Jest with NestJS testing module for backend
- Mock all injected dependencies
- Test with realistic packed UUIDs (use `packId()` to generate test IDs)
- Cover tenant isolation: test that service methods include org_id filtering
- Use AAA pattern (Arrange, Act, Assert)
- One `describe` block per method, one `it` block per scenario

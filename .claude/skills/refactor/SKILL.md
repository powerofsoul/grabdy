---
name: refactor
description: Safe cross-monorepo refactoring with blast radius tracing. Finds all usages before making changes, updates all packages, and verifies with type checking. Use when user says "refactor", "rename", "extract", "move", "restructure", or "reorganize".
disable-model-invocation: false
argument-hint: '[what to refactor]'
---

# Safe Refactoring Assistant

## Step 1: Understand the refactoring goal

From `$ARGUMENTS`, determine:

- What is being refactored (rename, extract, move, restructure)
- The source location and target
- Whether it crosses package boundaries (contracts, common, api, web)

## Step 2: Map the blast radius

CRITICAL: Before making any changes, find ALL references.

- Grep for the symbol name across the entire monorepo
- Check `packages/contracts/` for contract references
- Check `packages/common/` for shared type references
- Check `apps/api/` for backend usage
- Check `apps/web/` for frontend usage
- Check `db.ts` if renaming a database-related type
- Check migration files (read-only, never modify)

List every file that will need changes.

## Step 3: Plan changes

Present the blast radius to the user before executing:

- Files to modify (with line numbers)
- Files that reference the symbol but need no change (for awareness)
- Potential risks (breaking contract compatibility, frontend/backend mismatch)

## Step 4: Execute atomically

Make all changes across all packages in one pass:

1. Update the source (rename, move, extract)
2. Update all imports and references in consumers
3. Update contract schemas if field names changed
4. Update db.ts if column types changed (but NEVER modify migrations)
5. Update frontend hooks and components that reference the contract

## Step 5: Verify

Run type checking in both apps:

```bash
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

If errors remain, fix them. Do not leave broken types.

## Rules

- NEVER modify existing migration files
- NEVER use `as` casting to silence type errors from incomplete refactors
- NEVER use `// @ts-ignore` or `// @ts-expect-error`
- Update ALL references, not just the ones in the same file
- If renaming a contract field, update both backend and frontend consumers
- If moving a file, update all import paths

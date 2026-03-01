---
name: review
description: Code review of uncommitted git changes with blast radius analysis. Use when user says "review", "review my changes", "code review", or "/review". Traces callers, data flow, database impact, race conditions, auth, and project rule violations.
disable-model-invocation: true
allowed-tools: Bash, Read, Grep, Glob
argument-hint: '[path]'
---

# Code Review

Uncompromising code review. Don't just read the diff, trace everything it touches.

## Step 1: Gather context

If `$ARGUMENTS` is provided, scope to that path. Otherwise review everything.

- Run `git diff -- $ARGUMENTS` (unstaged) and `git diff --cached -- $ARGUMENTS` (staged)
- Run `git diff --name-only -- $ARGUMENTS` to get the list of changed files
- Read the full file for each changed file, diffs lie by omission

## Step 2: Blast radius analysis

CRITICAL: Do not just review the diff. For every changed function, type, query, or export, trace what it touches.

- **Find all callers/consumers.** Grep for usages across the codebase. If a function signature changed, did every caller update? If a return type changed, does downstream code still work? If something was deleted, is anything still importing it?
- **Trace the data flow.** Follow inputs from controller to service to database and back. Does the data survive the round trip? Are there fields that get set but never read, or read but never set? Does the API contract match what the frontend expects?
- **Check the database impact.** New WHERE clause without an index? Query inside a loop (N+1)? Missing transaction around multi-table writes? Cascade delete that orphans records? Column added in code but no migration?
- **Check concurrent behavior.** Can two requests hit this path simultaneously and corrupt state? Is there a read-then-write without a transaction? Does a BullMQ job retry safely or does it double-process? Are there race conditions between the queue processor and the API?
- **Check error paths.** What happens when this fails halfway? Does a failed database write leave inconsistent state? Is there a try/catch that swallows errors silently? Does a 500 leak internal details to the client?
- **Check React side effects.** Missing cleanup in useEffect? Stale closure capturing old state? Dependency array missing a value that changes? Component unmounts while async operation is in flight?
- **Check auth/access control.** New endpoint without auth guard? Existing endpoint that now exposes more data? Can user A access user B's resources by guessing IDs (IDOR)? Does the role check actually match the intended audience?
- **Check what was NOT changed.** If you renamed a field, did the contract update too? If you changed a Zod schema, did the frontend form update? If you changed an enum value, did every switch/map update? Half-refactors are the #1 source of prod fires.

## Step 3: Enforce project rules

Consult `references/project-rules.md` for the full checklist of project-specific violations to flag (TypeScript rules, ID system, frontend patterns, backend patterns, database rules).

## Step 4: Classify by severity

- 🔴 **CRITICAL**: security holes, leaked secrets, crashes, data loss, auth bypass
- 🟠 **HIGH**: null access, N+1 queries, race conditions, logic bugs, broken callers, missing migrations
- 🟡 **MEDIUM**: duplication, magic values, bad names, missing tests, dead code
- ⚪ **LOW**: typos, style, naming conventions

## Step 5: Output format

Start with a summary table:

| Severity    | Count |
| ----------- | ----- |
| 🔴 Critical | N     |
| 🟠 High     | N     |
| 🟡 Medium   | N     |
| ⚪ Low      | N     |

Then list each finding:

**🔴 `path/to/file.ts:42`** - Description of the issue

> Impact: what breaks in prod
> Fix: exact code change or approach

Be direct. No "maybe", no "consider". State what is wrong and how to fix it.

## Step 6: Verdict

- ❌ **REJECT**: any 🔴 or 3+ 🟠
- ⚠️ **FIX**: any 🟠 or 5+ 🟡
- ✅ **PASS**: only 🟡/⚪ below threshold

## Troubleshooting

### No changes found

If `git diff` returns empty, check `git status` for untracked files. Untracked files won't appear in diff but may still need review.

### Too many files changed

If 20+ files changed, prioritize: backend services and controllers first, then database/migrations, then frontend components, then types/contracts.

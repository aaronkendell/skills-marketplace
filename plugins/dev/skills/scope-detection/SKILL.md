---
name: scope-detection
description: >
  Use when implementing a feature and noticing changes that may be outside the planned scope.
  Triggers during execution when edits touch different domains, add unplanned features, or
  modify infrastructure not in the issue spec. Also use when reviewing a diff that seems
  larger than expected. Helps prevent scope creep during build phase.
user-invocable: false
---

# Scope Detection

Detects when implementation work is drifting outside the planned scope.

## When to Check

- Before modifying a file not listed in the issue's "Files to Touch" section
- When adding functionality not in the acceptance criteria
- When touching a domain different from the issue's primary domain
- When the diff grows significantly larger than expected for the issue size

## Detection Rules

1. **Domain boundary crossing**: If the issue is for the `rounds` domain but you're modifying `scoring` or `ai` domains, flag it.

2. **Unplanned file creation**: If creating a file not anticipated by the plan, pause and evaluate if it's necessary or scope creep.

3. **Feature additions**: If adding behavior not in the acceptance criteria (e.g., "while I'm here, let me also add X"), flag it.

4. **Refactoring during implementation**: If cleaning up code unrelated to the issue, flag it. Bug fixes are OK; cosmetic refactors are scope creep.

## Response

When scope creep is detected, present to the user:

```
Scope check: I'm about to modify files outside this issue's planned scope.

Planned: packages/golf/domains/src/packages/rounds/
Touching: packages/golf/domains/src/packages/scoring/

This change is needed because: [reason]

Options:
1. Proceed — this is a necessary dependency
2. Create a new issue — track this as separate work
3. Skip — implement without this change
```

Let the user decide. Don't block on minor cross-domain reads (importing a type is fine). Only flag when writing/modifying code outside scope.

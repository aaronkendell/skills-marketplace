# Example reviews

Worked examples of what a good review looks like end-to-end. Read this when you need to calibrate severity classification or report tone.

---

## Example 1 — single tRPC router

**User**: `/review apps/api/src/packages/projects/projects.trpc.router.ts`

**Resolution**: one file, matches `apps/*/api/**/*.ts` → `api.md`, `hono-api-anatomy.md`, `auth-and-scopes.md`.

**Loaded**: `references/review-criteria/api.md` (checklist), `references/patterns/api.md` (full reference). Skipped `auth-and-scopes.md` after first-read of the file — it doesn't touch auth directly.

**File content (abridged)**:
```ts
const projectService = new ProjectService(db);

export const projectsRouter = router({
  list: publicProcedure.query(async () => {
    return await projectService.list();
  }),
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => projectService.get(input.id)),
});
```

**Violations**:
- BLOCKING — Service instantiated directly (`new ProjectService(db)`) instead of injected from cradle.
- BLOCKING — `list` is missing `.input()` schema (api.md: every procedure declares input even if `z.object({})`).
- BLOCKING — `get` is missing `.output()` schema.
- BLOCKING — Both procedures are `publicProcedure` but query the projects table — likely should be `protectedProcedure`.
- IMPORTANT — No OpenAPI meta tags.
- IMPORTANT — `get` doesn't handle the not-found case; service returning null leaks as `undefined` to the client.

**Report**:

```markdown
## Review: 1 file against api.md (+ hono-api-anatomy.md, auth-and-scopes.md)

### apps/api/src/packages/projects/projects.trpc.router.ts
- ✗ BLOCKING — Service instantiated (`new ProjectService(db)`) → fixed: now `ctx.scope.cradle.projectService`
- ✗ BLOCKING — `list` missing input schema → fixed: added `.input(z.object({}))`
- ✗ BLOCKING — `get` missing output schema → fixed: added `.output(projectSchema)`
- ✗ BLOCKING — `publicProcedure` on data-reading routes → fixed: switched to `protectedProcedure`
- ⚠ IMPORTANT — Missing OpenAPI tags → fixed: added `.meta({ openapi: { method: "GET", path: "/projects", tags: ["projects"] } })`
- ⚠ IMPORTANT — Not-found handling missing on `get` → fixed: service returns null, mapped to `TRPCError({ code: "NOT_FOUND" })`

## Summary
- 1 file reviewed
- 4 BLOCKING fixed
- 2 IMPORTANT fixed
- 0 ADVISORY
- 0 items need your judgment
```

---

## Example 2 — multiple files, mixed scope

**User**: `please review the changes I just made` (no specific paths)

**Resolution**: `git status --short` returns:
```
 M packages/domains/src/packages/projects/application/project.service.ts
 M apps/app/src/packages/projects/components/project-card.tsx
?? apps/api/src/packages/projects/projects.trpc.router.test.ts
```

Three files, two pattern groups:
- `project.service.ts` → `ddd.md`
- `project-card.tsx` → `frontend.md`, `per-app-ui.md`
- `projects.trpc.router.test.ts` → `testing.md`

**Loaded**: all four pattern docs (each only once).

**Findings**:

```markdown
## Review: 3 files against ddd.md, frontend.md, per-app-ui.md, testing.md

### packages/domains/src/packages/projects/application/project.service.ts
- ✓ No violations found

### apps/app/src/packages/projects/components/project-card.tsx
- ✗ BLOCKING — Component uses `useState` for hover state → fixed: lifted to ProjectCardContainer, passed `isHovered` as prop
- ⚠ IMPORTANT — Imports `useProjectStore` directly → fixed: removed import; container now reads from store and passes selected slice as prop
- ℹ ADVISORY — Inline `interface ProjectCardProps` instead of `./types.ts` (not fixed; mention for next pass)

### apps/api/src/packages/projects/projects.trpc.router.test.ts
- ✗ BLOCKING — Test imports real `db` instead of using cradle.register to substitute mock → fixed: uses `scope.register({ db: asValue(mockDb) })` pattern
- ⚠ IMPORTANT — Missing 401 case for protected route → fixed: added test that asserts UNAUTHORIZED when no auth context
- ⚠ IMPORTANT — Test factory not used, raw insert calls → fixed: replaced with `projectFactory.create()`

## Summary
- 3 files reviewed
- 2 BLOCKING fixed
- 3 IMPORTANT fixed
- 1 ADVISORY noted
- 0 items need your judgment
```

---

## Example 3 — file with no pattern coverage

**User**: `/review packages/shared/utils/format-currency.ts`

**Resolution**: one file. No glob matches.

**Action**: do a generic code-quality pass since the user explicitly asked. Don't invent pattern violations.

**Report**:

```markdown
## Review: 1 file (no pattern coverage)

### packages/shared/utils/format-currency.ts
No pattern doc matches this path. Generic code-quality review:
- ✓ Function signature is clear and typed.
- ℹ ADVISORY — Magic number `100` for cents-to-dollars; consider `CENTS_PER_DOLLAR` constant if used elsewhere.
- ℹ ADVISORY — `toLocaleString` call has no explicit locale; will silently use server locale in SSR.

## Summary
- 1 file reviewed (generic pass, no pattern coverage)
- 0 BLOCKING, 0 IMPORTANT, 2 ADVISORY
- Consider adding a glob rule in `glob-map.md` if this directory should be covered by a pattern doc.
```

---

## What "good" looks like

- Each violation has a one-line description and a one-line fix description. No long-form explanations.
- BLOCKING is genuine architectural breach (cross-layer, leaked secret, missing scope, untyped IO). Not stylistic.
- IMPORTANT is meaningful pattern drift (missing required field, wrong helper used).
- ADVISORY is cheap to mention but not worth fixing automatically.
- "Needs your judgment" entries explain WHY they're stuck and what the options are.

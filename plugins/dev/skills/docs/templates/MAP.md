---
status: current
verified: YYYY-MM-DD
---

# Docs Map

> Retrieval contract. Read this first; load other docs only when a row below says to.
> Ownership rows are machine-parsed by the docs-freshness hook — keep the exact format
> shown in the Ownership section (repo-root-relative paths, backticks required).

## When working on X, read Y

| Task | Read |
|------|------|
| Anything non-trivial | `docs/architecture/overview.md` |
| <area> work | `docs/architecture/<area>.md`, `docs/product/features/<feature>.md` |

## Ownership (code → owning doc)

| code glob | owning doc |
|-----------|------------|
| `apps/api/**` | `docs/architecture/api.md` |

## Registry

| Doc | Status | One-liner |
|-----|--------|-----------|
| `docs/product/prd.md` | current | What the product is and for whom |

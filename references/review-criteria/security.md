# Security Review Criteria

Read this for every PR regardless of what changed.

## Authentication and authorization

- [ ] BLOCKING: Every API endpoint that accesses user data is protected by auth middleware
- [ ] BLOCKING: User ID always comes from the session (`requireUserId(c)`) — never from request body or params
- [ ] BLOCKING: Ownership validated in service (`area.userId !== userId → throw ForbiddenError`)
- [ ] BLOCKING: No endpoints that bypass auth with a secret parameter or query string

### Golf authz v2 (Principal + scopes + policies) — see `auth-and-scopes.md`

- [ ] BLOCKING: A service mutation on behalf of a caller takes `caller: Principal` and calls a Policy (`OwnershipPolicy.assertSelf` / membership / admin / `EntitlementPolicy`) — a route scope gate is NOT sufficient on its own
- [ ] BLOCKING: No service mutation takes a bare `userId` for an authorization decision (pass the `Principal`; derive via `requireSubjectId`)
- [ ] BLOCKING: `pnpm swarm check arch` (`service-mutation-requires-policy`) is at zero — no new `arch-allow` suppressions; caller-less mutations on a foreign id/email are gated too
- [ ] BLOCKING: Background/Inngest work threads a `Principal` (`systemActingAs(reason, userId)` per-user, `systemPrincipal(reason)` aggregate) — never a back door taking a bare `userId`; `reason` is registered in `GOLF_SYSTEM_CALLERS`
- [ ] BLOCKING: `Principal` is built with a factory (`userPrincipal`/`adminPrincipal`/`systemPrincipal`/…) — never a hand-built literal
- [ ] IMPORTANT: Admin routes use `adminAreaProcedure(area)` with the least-privilege `admin:<area>` — not blanket `admin:all` — where an area fits
- [ ] IMPORTANT: Paid features gated by `EntitlementPolicy.assertEntitled` in the service — entitlement is NOT a scope; users keep `USER_SCOPES` on subscribe/unsubscribe
- [ ] IMPORTANT: Policy denials are audited (policy extends `AuthzPolicy`, typed `AuthzAction`/`AuthzResourceType`); anti-enumeration uses `opts.error → NotFound`

## Input validation

- [ ] BLOCKING: All user input validated with Zod at the API boundary before reaching service layer
- [ ] BLOCKING: No raw SQL string concatenation — all queries use Drizzle ORM parameterized queries
- [ ] BLOCKING: File paths from user input never used with `fs` operations without sanitization

## Secrets and sensitive data

- [ ] BLOCKING: No API keys, tokens, or secrets in code — all from environment variables
- [ ] BLOCKING: No `.env` files committed (check `git diff` includes no new .env files)
- [ ] BLOCKING: Error messages returned to client contain no stack traces, file paths, or internal details
- [ ] IMPORTANT: Database connection strings logged at startup with password redacted

## Dependencies

- [ ] IMPORTANT: No new dependencies added without a clear reason
- [ ] ADVISORY: New dependencies not flagged by `pnpm audit`

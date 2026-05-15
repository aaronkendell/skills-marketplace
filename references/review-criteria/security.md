# Security Review Criteria

Read this for every PR regardless of what changed.

## Authentication and authorization

- [ ] BLOCKING: Every API endpoint that accesses user data is protected by auth middleware
- [ ] BLOCKING: User ID always comes from the session (`requireUserId(c)`) — never from request body or params
- [ ] BLOCKING: Ownership validated in service (`area.userId !== userId → throw ForbiddenError`)
- [ ] BLOCKING: No endpoints that bypass auth with a secret parameter or query string

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

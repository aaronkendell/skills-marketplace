# API Review Criteria

> Full reference: `docs/context/patterns/api.md`

## Route handlers

- [ ] BLOCKING: Route handlers contain no business logic — only: get auth context, call service, map to DTO, return response
- [ ] BLOCKING: Route handlers use injected service (from `@/core/services`) — never instantiate service or repository directly
- [ ] BLOCKING: All request bodies validated with Zod schema via `createRoute` / tRPC input schema
- [ ] BLOCKING: All protected routes have `requireAuth` middleware applied
- [ ] BLOCKING: User context extracted via `requireUserId(c)` — never trust raw user input for user ID

## tRPC vs Hono

- [ ] IMPORTANT: Standard CRUD uses tRPC procedures (`publicProcedure`, `protectedProcedure`, `internalProcedure`)
- [ ] IMPORTANT: Streaming (SSE, AI responses) and inbound webhooks use plain Hono routes
- [ ] IMPORTANT: New tRPC routers registered in the root tRPC router

## OpenAPI (Hono REST routes only)

- [ ] IMPORTANT: Every Hono REST route uses `createRoute()` with explicit request/response schemas
- [ ] IMPORTANT: Tags, summary, and description set on every route
- [ ] ADVISORY: `openapi.json` snapshot updated if new routes added

## Error handling

- [ ] BLOCKING: `NotFoundError` mapped to 404
- [ ] BLOCKING: `ForbiddenError` mapped to 403
- [ ] BLOCKING: `ValidationError` mapped to 400
- [ ] IMPORTANT: No raw error messages leaked in responses (check for stack traces, internal paths)

## oRPC error bridge (golf only)

- [ ] BLOCKING: `publicBase`, `protectedBase`, `internalBase` each have an `appErrorBridgeFn` wrapper — domain `AppError` must never escape to the oRPC normalizer as an untyped throw
- [ ] BLOCKING: Typed procedure errors declared via `.errors()` are thrown as `ORPCError("CODE", { data })` — never as `AppError` or raw `Error`
- [ ] IMPORTANT: Zod validation errors surface as `INPUT_VALIDATION_FAILED` (422) — do not manually throw `BAD_REQUEST` for schema failures; `createBaseOrpc` handles the transform
- [ ] IMPORTANT: New `.errors()` codes have a corresponding client-side `if (err.code === "NEW_CODE")` branch (no string maps)

## Testing

- [ ] BLOCKING: Route test file exists (`*.routes.test.ts` or `*.trpc.router.test.ts`)
- [ ] BLOCKING: Tests use mocked service — not real DB
- [ ] IMPORTANT: 200/201 happy path covered
- [ ] IMPORTANT: 401/403/404 error cases covered

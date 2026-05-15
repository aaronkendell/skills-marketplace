# Testing Review Criteria

> Full reference: `docs/context/patterns/testing.md`

## Coverage requirements

- [ ] BLOCKING: Every new service method has a unit test
- [ ] BLOCKING: Every new repository method has an integration test (uses Testcontainers real DB)
- [ ] BLOCKING: Every new API route has a route test (mocked service)
- [ ] BLOCKING: Every new util function has a unit test
- [ ] IMPORTANT: Happy path + at least one error/not-found case per method

## Test file location

- [ ] BLOCKING: Entity tests at `domain/entities/{entity}.entity.test.ts`
- [ ] BLOCKING: Service tests at `application/{entity}.service.test.ts`
- [ ] BLOCKING: Repository tests at `infrastructure/persistence/{entity}.repository.test.ts`
- [ ] BLOCKING: Route tests at `apps/*/api/src/domains/{domain}/{domain}.routes.test.ts` or `*.trpc.router.test.ts`

## Test quality

- [ ] BLOCKING: No `test.only` or `describe.only` committed
- [ ] BLOCKING: No `vi.mock` with empty implementation (tests must actually assert behavior)
- [ ] IMPORTANT: Repository tests use `ctx.reset()` in `beforeEach` to isolate state
- [ ] IMPORTANT: Service unit tests mock the repository (`vi.fn()`) and verify the mock is called correctly
- [ ] ADVISORY: Integration tests wrapped in `describe.skipIf(skipIfNoTestDb)(...)` so they skip without Docker

## Factories

- [ ] IMPORTANT: New DB tables have a factory function in `packages/*/db/src/lib/testing/factories/`
- [ ] IMPORTANT: Factories use `createId()` for IDs and sensible defaults

# DDD Review Criteria

> Full reference: `docs/context/patterns/ddd.md`

## Service layer (application/)

- [ ] BLOCKING: Service is a factory function `export function create{X}Service(deps: {X}ServiceDeps)` — not a class, not a singleton
- [ ] BLOCKING: Service receives all dependencies via `deps` parameter — never imports DB or repository directly
- [ ] BLOCKING: Service throws `NotFoundError` when entity not found (never returns null)
- [ ] BLOCKING: Service throws `ForbiddenError` for ownership violations
- [ ] BLOCKING: Service never calls other repositories directly — only its own repository + injected services for cross-domain
- [ ] IMPORTANT: Private helper functions defined inside the factory (not exported)
- [ ] IMPORTANT: All public methods have explicit return type annotations

## Repository layer (infrastructure/persistence/)

- [ ] BLOCKING: Repository is a factory function `export function create{X}Repository(deps?: {X}RepositoryDeps)`
- [ ] BLOCKING: `findById` returns `null` when not found — never throws
- [ ] BLOCKING: `findAll*` returns empty array when none found — never throws
- [ ] BLOCKING: All DB operations use mapper functions (`toDomain`, `toORM`) — no raw ORM types returned
- [ ] BLOCKING: Repository accepts `db` via deps with fallback to default: `const database = deps?.db ?? defaultDb`
- [ ] IMPORTANT: No business logic in repository methods (sorting, filtering by business rules belong in service)

## Entity layer (domain/entities/)

- [ ] BLOCKING: Entity is a Zod schema + inferred type + factory function `create{X}(data)`
- [ ] BLOCKING: Factory function validates and sets `id` (cuid2), `createdAt`, `updatedAt`
- [ ] IMPORTANT: All optional fields use `.nullable()` not `.optional()` (for RHF compatibility)

## Presentation layer (presentation/)

- [ ] BLOCKING: Request/response schemas are Zod schemas in `schemas/` subdirectory
- [ ] BLOCKING: Domain → DTO mapping is in `mappers/` subdirectory — not inline in routes
- [ ] BLOCKING: No domain objects leak into responses — always map through DTO

## Cross-domain rules

- [ ] BLOCKING: Domain A imports from Domain B only via `@bokendell/{app}-domains/{domain}` (the public index) — never internal paths
- [ ] BLOCKING: Cross-domain operations go through service methods — never direct repository calls
- [ ] IMPORTANT: Cross-domain service dependency injected via `deps` parameter

## File structure

- [ ] IMPORTANT: Domain index (`index.ts`) exports only public types and factory functions — not internal types
- [ ] IMPORTANT: New domain follows the 8-file structure: entity, service, repository, mapper, request schema, response schema, dto mapper, index

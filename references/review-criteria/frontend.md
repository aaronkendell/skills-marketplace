# Frontend Review Criteria (Next.js)

> Full reference: `docs/context/patterns/frontend.md`

## Component architecture

- [ ] BLOCKING: One component per file — no multiple component exports from one file
- [ ] BLOCKING: Screen/page components are pure presentation — receive all data as props
- [ ] BLOCKING: Container components are orchestrators — import domain hook, pass state to screen
- [ ] BLOCKING: No business logic inside screen or component files — belongs in hooks or utils
- [ ] IMPORTANT: Types declared in `types.ts`, not inline — no anonymous object types in component props
- [ ] IMPORTANT: Constants declared in `constants.ts`, not inline

## Hooks

- [ ] BLOCKING: Domain hook (`use{Domain}.ts`) composes store + queries + mutations — returns a single unified state object
- [ ] BLOCKING: Form hooks (`hooks/forms/use-create-{entity}-form.ts`) manage RHF state only — do not call mutations
- [ ] IMPORTANT: Form hooks receive `onSubmit` callback from domain hook — they do not call mutations directly

## Zustand stores

- [ ] BLOCKING: Stores contain UI state only (selections, filters, search, expanded) — no server state, no API calls
- [ ] IMPORTANT: Store resets on relevant lifecycle events (logout, domain change)

## Queries and mutations

- [ ] BLOCKING: All data fetching uses tRPC via `useTRPC()` — no raw fetch calls
- [ ] IMPORTANT: Cache invalidation uses `trpc.{router}.{procedure}.queryKey()` — not manual string keys

## Schemas

- [ ] BLOCKING: Zod form schemas use `.nullable()` not `.optional()` for optional fields (RHF compatibility)
- [ ] IMPORTANT: Schemas defined locally in `schemas/` — not imported from shared packages

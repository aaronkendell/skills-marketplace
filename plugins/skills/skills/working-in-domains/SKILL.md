---
name: working-in-domains
description: Use when adding to or creating a domain package — where a piece of logic belongs, what each layer may import, the client-safe vs server-only split, and how to check the result. Triggers on "create a domain", "add a service/repository/entity", "where does this go", or any work under packages/domains/.
---

# Working inside a domain

Domain structure in these repos is **machine-enforced**, not documented-and-hoped.
Roughly 100 architecture rules live in
`swarm/packages/domains/src/packages/check/infrastructure/arch/semantic/`, each with
its own tests. They are the authority on structure — this skill exists to explain
the reasoning they encode, so you write conforming code the first time.

```bash
pnpm swarm check arch              # whole repo
pnpm swarm check arch --affected   # just what you changed — use this while iterating
```

**When this skill and a rule disagree, the rule wins.** Read its header comment; each
one opens with why it exists, usually naming the outage that produced it.

## Layout

```
packages/domains/src/packages/{domain}/
├── domain/          # pure logic — entities, guards, constants, types, utils. No I/O.
├── application/     # services: orchestration, transactions, policy
├── infrastructure/  # repositories, renderers, vendor adapters
├── presentation/    # response schemas + to{Entity}Response mappers
├── integration/     # cross-domain wiring
├── client.ts        # BROWSER-SAFE public surface
├── internal.ts      # SERVER-ONLY surface
└── index.ts         # public barrel
```

Don't scaffold all of these up front. A domain earns a layer when it has something to
put in it — an `infrastructure/` with no repository is noise. Nest by feature inside a
layer (`application/share/share.service.ts`), not by kind: there is no
`entities/` or `schemas/` folder holding one file each.

Name the directory after the domain as it reads in the ubiquitous language —
`rounds`, `courses`, but also `billing`, `auth`, `share`. Plural is not a rule.

## Where a piece of logic goes

| It... | Belongs in |
|---|---|
| decides something from its inputs alone | `domain/` |
| needs a repository, a transaction, or another service | `application/` |
| talks to Postgres, a vendor SDK, the filesystem, or renders | `infrastructure/` |
| shapes a response for the wire | `presentation/` |
| reacts to another domain's events | `integration/` |

The test for `domain/`: could it run in a unit test with no database, no network, and
no mocks? If yes it belongs there, and that is where it is cheapest to test.

## The client-safe / server-only split

This is the one that causes outages, so it gets its own section.

`client.ts` is what a browser or React Native bundle may import. `internal.ts` is
everything else. The split is about **value** imports — type-only imports are erased
before a bundler sees them, so they never matter here.

Golf's `client-safe-entries.guard.test.ts` walks the real import graph from every
client-safe entry and fails with the chain printed. It exists because a five-hop
transitive import took every device down at once:

```
rounds/realtime → round-realtime.service → round-events
  → round.entity → round.factory → join-code → node:crypto
```

`round.entity` re-exported its own factory — a line with no consumer — and
`realtime.ts`, whose header said "Safe to import in React Native", exported a server
service. Metro has no Node builtins, so this is not a degraded feature: it is an
undismissable red screen on every device simultaneously.

Two things follow. A barrel that re-exports something with no consumer is not
harmless. And a comment claiming a file is client-safe proves nothing — only the
guard does.

## Import boundaries

Enforced by `layer-purity-rule`, `cross-domain-rule`, `import-boundaries-rule`,
`repository-boundary-rule`:

- Repositories stay **behind** the service layer. Client packages call application or
  API facades — never a repository, Drizzle, or a `db` package.
- `packages/composition/` wires services together. It may import a domain's public
  barrel and nothing deeper — never `domain/`, `application/`, `infrastructure/`, or
  `presentation/` directly.
- API routers resolve services from the cradle. A router importing a repository or db
  module is a boundary break, not a shortcut.
- Cross-domain access goes through the other domain's **public barrel**. Reaching into
  its internals couples you to its refactors.
- Domain code never imports a vendor SDK (`no-vendor-sdk-import-in-domain-rule`). Go
  through `@bokendell/{redis,emails,push-notifications,realtime,events,analytics,storage,sms,discord}`.

## Rules worth knowing before you write

These catch most first-draft mistakes:

| Rule | What it wants |
|---|---|
| `no-process-env-outside-config-rule` | env only via the zod-validated config |
| `no-transaction-in-router-rule` | transactions belong in services, not routers |
| `service-mutation-requires-policy-rule` | a mutating service method states its policy |
| `service-factory-rule` | services are factory functions, resolved from the cradle |
| `no-module-level-cradle-read-rule` | resolve from the cradle per request, not at import |
| `no-nested-barrels-rule` | barrels don't re-export barrels |
| `no-types-folder-rule` | one flat `types.ts`, never a `types/` folder of fragments |
| `no-silent-catch-rule` | no swallowed errors |
| `no-console-in-domain-rule` | use the logger |
| `missing-test-rule` | new logic ships with a test |
| `no-emoji-in-source-rule` | no emoji in source |

Many rules (57 of them) accept a scoped opt-out comment (`// arch-allow <rule-name>: <reason>`).
Use it when the rule is genuinely wrong for a case and say why — an opt-out with a
real reason is fine; silencing a rule you didn't read is not.

## The API surface on top

A domain is reached through a contract + router pair in `apps/api/src/packages/{domain}/`.
That layer has its own rules — `orpc-contract-purity-rule`,
`orpc-router-implements-contract-rule`, `orpc-router-inline-schema-rule`,
`orpc-route-schema-from-domain-rule`. See `references/patterns/api.md` for the shape,
and golf's `api-endpoint` skill for the judgment about what an endpoint should be.

Response mapping belongs in `presentation/` as `to{Entity}Response` helpers
(`mapper-location-rule`). Routers never hand-build a response object.

## Before you call it done

```bash
pnpm swarm check arch --affected
```

Then read `packages/domains/src/packages/rounds/` — it is the fullest worked example
in the workspace, and it is current in a way no template in a skill file can stay.

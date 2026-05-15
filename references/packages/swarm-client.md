# @bokendell/swarm-client — Agent Context

> Location: `packages/swarm/client/`
>
> Browser-facing tRPC client for **swarm-api**. The studio (and any future browser surface that talks to swarm-api) consumes this single package — no per-feature REST wrappers, no duplicated types.

Mirrors the per-app client pattern (`packages/{golf,hive,portfolio}/client`). One client package per backend.

## What's inside

| Subpath | Exports | What it does |
|---|---|---|
| `.` (root barrel) | All tRPC primitives + browser-safe domain types (annotations, allowlist) | Default import surface — most consumers only need this |
| `/trpc` | `createSwarmTRPCClient` · `createSwarmVanillaClient` · `TRPCProvider` · `useTRPC` · `useTRPCClient` · `AppRouter` · `TRPCClientOptions` | tRPC client factory + React Query bindings |

```ts
// Setup (handled by @bokendell/design/mount for studios — done once per app)
import { createSwarmTRPCClient, TRPCProvider } from "@bokendell/swarm-client/trpc";
import { QueryClientProvider } from "@tanstack/react-query";

const { trpcClient, queryClient } = createSwarmTRPCClient({ url: swarmApiUrl });

<QueryClientProvider client={queryClient}>
  <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
    <App />
  </TRPCProvider>
</QueryClientProvider>;
```

```ts
// In components — fully typed, no manual URLs / fetch / JSON.parse
import { useTRPC } from "@bokendell/swarm-client/trpc";
import { useQuery, useMutation } from "@tanstack/react-query";

const trpc = useTRPC();
const { data } = useQuery(trpc.annotations.list.queryOptions({ app: "golf", flow }));
const reply = useMutation(trpc.annotations.reply.mutationOptions());
```

```ts
// For types only (e.g. component props, form schemas)
import type { AnnotationResponse, AnnotationStatus, CreateSeedRequest } from "@bokendell/swarm-client";
```

```ts
// In scripts / CLI tools — vanilla (no React Query)
import { createSwarmVanillaClient } from "@bokendell/swarm-client/trpc";

const client = createSwarmVanillaClient({
  url: process.env.SWARM_API_URL!,
  headers: () => ({ Authorization: `Bearer ${process.env.SWARM_API_KEY}` }),
});
const result = await client.annotations.list.query({ app: "golf" });
```

## URL handling

`createSwarmTRPCClient({ url })` accepts either:
- The swarm-api base (e.g. `https://api.swarm.bokendell.com`) — `/api/trpc` is appended automatically.
- A full tRPC endpoint (anything containing `/trpc`) — used as-is.

This means studios pass `swarmApiUrl` and stop thinking about path suffixes.

## Auth

Browser surfaces lean on cookie-based session auth — `createSwarmTRPCClient` calls through `createTRPCClientPair` (from `@bokendell/api/trpc-client`), which sets `credentials: "include"`. Studios mount `<DesignAuthProvider>` (Better Auth) alongside the tRPC provider; the cookie travels automatically.

Vanilla clients (scripts, CLI, agents) pass an `Authorization: Bearer swarm_*` header — Better Auth's api-key plugin synthesizes a session from the bearer token, so the same routes work.

## Adding a new procedure

1. Add the procedure to `apps/swarm/api/src/packages/<topic>/<topic>.trpc.router.ts`.
2. Add the topic router to `apps/swarm/api/src/packages/api/v1/trpc.router.ts`.
3. (If the schema lives in `swarm-domains`) export new request/response types from the relevant `.../client.ts` and add them to `packages/swarm/client/src/index.ts`'s re-export list.
4. Consumer code immediately sees the new procedure typed at `trpc.<topic>.<procedure>` — no client regen, no codegen step.

## Anti-patterns — what NOT to do

- **Don't hand-roll `fetch` against `/api/v1/*`.** Use the tRPC client. Types and validation come for free.
- **Don't re-declare DTOs in consumer code.** Import from `@bokendell/swarm-client`. If something's missing, add the export here (not in the consumer).
- **Don't import `@bokendell/swarm-api/trpc` directly from a browser surface.** It pulls server-only modules. Always go through `@bokendell/swarm-client` — only the `AppRouter` type crosses the boundary, and we re-export that one symbol.
- **Don't construct your own `QueryClient`** in a per-feature module. Studios mount one at the root via `createStudioApp`; consumers reach for `useQueryClient()` to share it.

## See also

- `context/packages/design.md` — the design studio framework that consumes this client.
- `context/patterns/design-studio.md` — how annotations flow end-to-end.
- `packages/golf/client/`, `packages/portfolio/client/`, `packages/hive/client/` — sibling per-app client packages with the same shape.

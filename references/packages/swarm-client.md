# @bokendell/swarm-client — Agent Context

> Location: `packages/client/`
>
> Browser-facing oRPC client for **swarm-api**. The studio (and any future browser surface that talks to swarm-api) consumes this single package — no per-feature REST wrappers, no duplicated types.

Mirrors the per-app client pattern (`packages/{golf,hive,portfolio}/client`). One client package per backend.

## What's inside

| Subpath | Exports | What it does |
|---|---|---|
| `.` (root barrel) | All oRPC primitives + browser-safe domain types (annotations, allowlist) | Default import surface — most consumers only need this |
| `/orpc` | `createSwarmClient` · `createVanillaSwarmClient` · `createSwarmQueryUtils` · `swarmKeys` · `getSwarmErrorCode` · types `SwarmClient` · `SwarmClientPair` · `SwarmQueryUtils` · `SwarmRouterInputs` · `SwarmRouterOutputs` · `SwarmVanillaClient` | oRPC client factory + TanStack Query bindings |

There is no `/trpc` subpath. The package exports exactly two entry points, `.` and `/orpc`.

```ts
// Setup (handled by @bokendell/design/mount for studios — done once per app)
import { SwarmOrpcProvider } from "@bokendell/design/mount";
import { createSwarmClient } from "@bokendell/swarm-client/orpc";
import { QueryClientProvider } from "@tanstack/react-query";

// `createSwarmClient` builds the oRPC query-utils AND a configured QueryClient in
// one call — the same construction `mountStudio` / `createStudioApp` use.
const [{ orpc, queryClient }] = useState(() => createSwarmClient({ url: swarmApiUrl }));

<QueryClientProvider client={queryClient}>
  <SwarmOrpcProvider value={orpc}>
    <App />
  </SwarmOrpcProvider>
</QueryClientProvider>;
```

`SwarmOrpcProvider` takes a single `value` (the `SwarmQueryUtils`) — not a client and
a QueryClient. The QueryClient goes on `QueryClientProvider`, one level out.

```ts
// In components — fully typed, no manual URLs / fetch / JSON.parse
import { useSwarmOrpc } from "@bokendell/design/mount";
import { useMutation, useQuery } from "@tanstack/react-query";

const orpc = useSwarmOrpc();
const { data } = useQuery(orpc.annotations.list.queryOptions({ input: { app: "golf", flow } }));
const reply = useMutation(orpc.annotations.reply.mutationOptions());
```

```ts
// For types only (e.g. component props, form schemas)
import type { AnnotationResponse, AnnotationStatus, CreateSeedRequest } from "@bokendell/swarm-client";
```

```ts
// In scripts / CLI tools — vanilla (no React Query)
import { createSwarmVanillaClient } from "@bokendell/swarm-client/orpc";

const client = createSwarmVanillaClient({
  url: process.env.SWARM_API_URL!,
  headers: () => ({ Authorization: `Bearer ${process.env.SWARM_API_KEY}` }),
});
const result = await client.annotations.list.query({ app: "golf" });
```

## URL handling

`createSwarmClient({ url })` accepts either:
- The swarm-api base (e.g. `https://api.swarm.bokendell.com`) — `/api/rpc` is appended automatically.
- A full oRPC endpoint (anything containing `/rpc`) — used as-is.

swarm-api serves its RPC surface at `/api/rpc` and its REST surface at `/api/v1`.

This means studios pass `swarmApiUrl` and stop thinking about path suffixes.

## Auth

Browser surfaces lean on cookie-based session auth — `createSwarmClient` calls through `createORPCClientPair` (from `@bokendell/api/orpc-client`), which sets `credentials: "include"`. Studios mount `<DesignAuthProvider>` (Better Auth) alongside the oRPC provider; the cookie travels automatically.

Vanilla clients (scripts, CLI, agents) pass an `Authorization: Bearer swarm_*` header — Better Auth's api-key plugin synthesizes a session from the bearer token, so the same routes work.

## Adding a new procedure

1. Add the procedure to `apps/api/src/packages/<topic>/<topic>.orpc.router.ts`.
2. Add the topic router to `apps/api/src/packages/api/v1/orpc.router.ts`.
3. (If the schema lives in `swarm-domains`) export new request/response types from the relevant `.../client.ts` and add them to `packages/client/src/index.ts`'s re-export list.
4. Consumer code immediately sees the new procedure typed at `orpc.<topic>.<procedure>` — no client regen, no codegen step.

## Anti-patterns — what NOT to do

- **Don't hand-roll `fetch` against `/api/v1/*`.** Use the oRPC client. Types and validation come for free.
- **Don't re-declare DTOs in consumer code.** Import from `@bokendell/swarm-client`. If something's missing, add the export here (not in the consumer).
- **Don't import `@bokendell/swarm-api/orpc` directly from a browser surface.** It pulls server-only modules. Always go through `@bokendell/swarm-client` — only the `AppRouter` type crosses the boundary, and we re-export that one symbol.
- **Don't construct your own `QueryClient`** in a per-feature module. Studios mount one at the root via `createStudioApp`; consumers reach for `useQueryClient()` to share it.

## See also

- `context/packages/design.md` — the design studio framework that consumes this client.
- `context/patterns/design-studio.md` — how annotations flow end-to-end.
- `packages/client/`, `packages/client/`, `packages/client/` — sibling per-app client packages with the same shape.

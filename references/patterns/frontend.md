# Frontend Patterns (Next.js + React)

Web frontend follows the **exact same architecture as mobile** — containers, screens, hooks, stores, utils, `types.ts`, `constants.ts`. Read `patterns/mobile.md` first. This document covers only what differs.

---

## What's the same

- Package structure per domain (`containers/`, `screens/`, `hooks/`, `stores/`, `schemas/`, `utils/`, `types.ts`, `constants.ts`)
- Container = orchestrator. Screen = pure presentation. Components = dumb. **Statically enforced** by `swarm check arch`: `review-container-not-orchestrator` flags a `containers/` file that only does presentational work (local state / form hook, no data/store/identity/domain hook — i.e. a dumb component relocated to dodge a purity rule), and `review-component-not-dumb` flags a `components/`/`screens/` file that imports a data/query/mutation/identity or store hook. Local UI hooks (animation, layout, disclosure) are allowed in components; the folder is a real contract.
- Domain hook composes store + queries + mutations
- Form hooks in `hooks/forms/` — never call mutations
- Zustand stores: non-persisted by default, persist preferences via `localStorage`
- Zod schemas always `.nullable()` for RHF fields
- All types in `types.ts`, all constants in `constants.ts`
- One component per file
- Business logic → `utils/` with tests
- tRPC via `useTRPC()` for all queries and mutations
- Query invalidation via `trpc.{router}.{procedure}.queryKey()`

---

## What's different

### UI components

| Mobile | Web |
|--------|-----|
| `@bokendell/shared/mobile-ui` | `@bokendell/shared/ui` (Shadcn/ui) |
| `View`, `Text`, `Pressable` | `div`, `p`, `button` |
| `SafeAreaView` | Layout wrapper or `main` |
| `FlatList` | `ul`/`li` or virtualized list |
| `BottomSheet` | `Dialog`, `Sheet` from Shadcn |
| `ScrollView` | CSS overflow-y |
| NativeWind (`className`) | Tailwind CSS 4 (`className`) |

### Token contract

Both web and mobile pull brand tokens from `@bokendell/<app>-ui/tokens.css`.
The per-app UI package **must not** redefine `--spacing-N` numerically (it
breaks every shadcn primitive). Brand-bigger spacings live under semantic
names (`--spacing-xl`, `--spacing-2xl`, `--spacing-3xl`, or fully named
like `--spacing-page`). Full contract in
[`docs/context/patterns/per-app-ui.md`](./per-app-ui.md).

### No haptics

Web has no haptic feedback. Remove all `Haptics.*` calls.

### No `useRegisterBottomSheet`

Tab bar hiding is mobile-only. Web dialogs/sheets use Shadcn primitives directly — no visibility context needed.

### Routing

| Mobile | Web |
|--------|-----|
| `useLocalSearchParams<{ id: string }>()` | `useParams<{ id: string }>()` (Next.js) |
| `useRouter(); router.push(...)` | `useRouter(); router.push(...)` (next/navigation) |
| `usePathname()` | `usePathname()` (next/navigation) |
| `<Redirect href="/login" />` | `redirect("/login")` or `<Redirect>` |

```typescript
// Web container — auth guard
import { useRouter } from "next/navigation";
import { useSession } from "@bokendell/portfolio-auth/client";

export function RoundsContainer() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  if (isPending) return <LoadingScreen />;
  if (!session) {
    router.push("/login");
    return null;
  }

  const state = useRounds();
  return <RoundsScreen {...state} />;
}
```

### Persist stores with localStorage

```typescript
// stores/rounds-ui-store.ts
export const useRoundsUIStore = create<RoundsUIState>()(
  persist(
    (set) => ({ ...initialState, /* actions */ }),
    {
      name: "rounds-ui-storage",
      storage: createJSONStorage(() => localStorage), // not AsyncStorage
    },
  ),
);
```

### Server components

Next.js App Router supports React Server Components. Use them for **layout-level data** fetching that doesn't need interactivity:

```typescript
// app/rounds/layout.tsx — Server Component (no "use client")
export default async function RoundsLayout({ children }: { children: React.ReactNode }) {
  // Can fetch data here, pass as props to children
  return <div className="flex">{children}</div>;
}
```

**Rule:** Default to client components with tRPC for feature data. Use server components only for layouts or static data that doesn't need React Query's caching, refetching, or optimistic updates.

Mark client components explicitly:

```typescript
"use client";

export function RoundsContainer() {
  // tRPC hooks require client context
  const trpc = useTRPC();
  // ...
}
```

---

## Package structure (same as mobile, plus `meta.ts`)

```
src/packages/{domain}/
├── components/
├── containers/
│   └── {domain}-container.tsx    # "use client" if interactive, async if server
├── screens/
│   └── {domain}-screen.tsx       # "use client" if interactive
├── hooks/
│   ├── use-{domain}.ts
│   └── forms/
├── stores/
│   └── {domain}-ui-store.ts
├── schemas/
├── utils/
├── types.ts
├── constants.ts
├── meta.ts                       # Next.js-only: page metadata, JSON-LD, route config
└── index.ts
```

### `meta.ts` — page metadata & SEO

**Web-only** (mobile doesn't have routes). Every domain that owns a public route exposes a **single `PageMeta` bundle** from its `meta.ts`. The bundle holds the Next.js `metadata`, any JSON-LD `schemas`, and advisory `revalidate`/`dynamic`/`dynamicParams` values. The route file then renders `<PageStructuredData meta={bundle} />` and assigns `export const metadata = bundle.metadata`. This keeps the schema and `<head>` metadata in lockstep — no dual records.

```typescript
// packages/projects/meta.ts
import type { PageMeta } from "@packages/site";

const projectsListSchema = {
	"@context": "https://schema.org",
	"@type": "CollectionPage",
	name: "Projects",
	url: "https://bokendell.com/projects",
} as const;

export const projectsPageMeta = {
	metadata: {
		title: "Projects",
		description: "Shipped work, open source, and side projects worth looking at.",
		alternates: { canonical: "/projects" },
		openGraph: {
			title: "Projects · Bo Kendell",
			description: "Shipped work, open source, and side projects worth looking at.",
			url: "/projects",
			type: "website",
		},
	},
	schemas: [projectsListSchema],
} as const satisfies PageMeta;
```

```typescript
// app/projects/page.tsx — always thin
import { ProjectsContainer } from "@packages/projects";
import { projectsPageMeta } from "@packages/projects/meta";
import { PageStructuredData } from "@packages/site";
import type { Metadata } from "next";

export const metadata: Metadata = projectsPageMeta.metadata;

export default function ProjectsRoute() {
	return (
		<>
			<PageStructuredData meta={projectsPageMeta} />
			<ProjectsContainer />
		</>
	);
}
```

**Dynamic routes.** Keep `generateMetadata` and `generateStaticParams` in `meta.ts` as named helpers. The route file assigns them to the required export names. Use a `buildXPageMeta(detail)` helper to construct a bundle from per-request data:

```typescript
// packages/blog/meta.ts
export async function generateBlogPostMetadata({ params }: Props): Promise<Metadata> { /* ... */ }
export function buildBlogPostPageMeta(slug: string, post: BlogPostInput | null): PageMeta | null { /* ... */ }

// app/blog/[slug]/page.tsx
export const generateMetadata = generateBlogPostMetadata;
// ...inside the route default: render <PageStructuredData meta={buildBlogPostPageMeta(slug, post)} />
```

**Rules:**
- `meta.ts` exports **one** `PageMeta` bundle per route (`<name>PageMeta`). JSON-LD schemas live inside the bundle's `schemas` array — never as a second named export.
- The route file **always** uses `<PageStructuredData meta={bundle} />`. Don't import individual schemas and render raw `<StructuredData />` — that reintroduces dual records.
- Next.js requires route-segment primitives (`revalidate`, `dynamic`, `dynamicParams`, `generateMetadata`, `generateStaticParams`) to be declared **at the top of the route module**, not re-exported via `export { X } from`. So:
  - `metadata` / `generateMetadata` / `generateStaticParams` → import from `meta.ts` and assign: `export const metadata = bundle.metadata; export const generateMetadata = generateXMetadata;`
  - `revalidate` / `dynamic` / `dynamicParams` → declare inline as `export const revalidate = 3600` (Next.js can't statically analyze imported values). The bundle may carry the same value as a hint for humans, but the route is authoritative.
- Shared SEO objects (e.g., `personSchema`, `websiteSchema` used on multiple pages) live in `packages/site/schemas.ts` and get pulled into each page's bundle by reference.
- Keep `meta.ts` dependency-free: no React imports, no client-only modules. It must be importable from both server components and server metadata resolution.

---

## tRPC client setup (Next.js)

```typescript
// packages/{app}/client/src/trpc.ts
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@bokendell/portfolio-api";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();
```

Usage is identical to mobile:

```typescript
"use client";

export function useRounds() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const roundsQuery = useQuery(trpc.rounds.list.queryOptions());
  const createMutation = useMutation(
    trpc.rounds.create.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.rounds.list.queryKey() }),
    }),
  );

  return {
    rounds: roundsQuery.data ?? [],
    isLoading: roundsQuery.isLoading,
    handleCreate: (data: CreateRoundData) => createMutation.mutate(data),
    isCreating: createMutation.isPending,
  };
}
```

---

## Differences summary

| Aspect | Mobile | Web |
|--------|--------|-----|
| UI package | `@bokendell/shared/mobile-ui` | `@bokendell/shared/ui` |
| Routing | Expo Router | Next.js App Router |
| Params | `useLocalSearchParams` | `useParams` |
| Haptics | Yes, on all interactions | None |
| Bottom sheet | `useRegisterBottomSheet` | Shadcn `Sheet`/`Dialog` directly |
| Store persist | `AsyncStorage` | `localStorage` |
| Server components | No | Yes, for layouts |
| Styling | NativeWind (`className`) | Tailwind CSS 4 (`className`) |
| `"use client"` | Not needed | Required on containers + hooks |

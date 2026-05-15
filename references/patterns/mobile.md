# Mobile Patterns (Expo + React Native)

All mobile apps use Expo Router, tRPC, React Query, Zustand, and React Hook Form. Golf is the canonical reference — standardize on its patterns.

Brand chrome (Stack, Box, Button, Card, etc.) is provided by the per-app
UI package (`@bokendell/<app>-ui`) which wraps `@bokendell/mobile-ui` +
exposes `tokens.css` / `fonts.css`. Per-app UI packages follow a fixed
token contract — see [`per-app-ui.md`](./per-app-ui.md) for the rules,
notably: **never redefine `--spacing-N` numerically**, use semantic names
(`--spacing-xl`, etc.) for brand-bigger spacings.

---

## Package structure

Every domain is a self-contained package:

```
src/packages/{domain}/
├── components/              # Dumb, presentational — one component per file
├── containers/              # Orchestrators — all logic lives here
│   └── {domain}-container.tsx
├── screens/                 # Route screens — pure presentation, props from container
│   └── {domain}-screen.tsx
├── layouts/                 # Layout components — pure presentation, props from container
│   └── {domain}-layout.tsx
├── hooks/
│   ├── use-{domain}.ts      # Domain hook: composes store + queries + mutations
│   └── forms/               # Form hooks (RHF) — separate from domain hook
│       ├── use-create-{entity}-form.ts
│       └── use-edit-{entity}-form.ts
├── stores/
│   └── {domain}-ui-store.ts # Zustand — UI-only state
├── schemas/
│   └── {entity}-form.schema.ts  # Local Zod schemas — NOT shared
├── utils/
│   └── {helpers}.ts         # Standalone pure functions — all have tests
├── types.ts                 # ALL types and interfaces for this package
├── constants.ts             # ALL constants for this package
└── index.ts                 # Public exports only
```

**Rules:**
- Never declare types inline — they go in `types.ts`
- Never declare constants inline — they go in `constants.ts`
- One component per file — no exceptions
- Any extractable logic or standalone function goes in `utils/` with tests
- No business logic in screens, layouts, or components

---

## Layer responsibilities

```
┌──────────────────────────────────────────────────────────────┐
│  CONTAINER                                                    │
│  All business logic. Calls domain hook. Renders screen +     │
│  sheets. Handles auth guards, tab bar, navigation setup.      │
└──────────────────────────────────────────────────────────────┘
          │ props (data + handlers only)
          ▼
┌──────────────────────────────────────────────────────────────┐
│  SCREEN / LAYOUT                                             │
│  Pure presentation. Receives all props from container.        │
│  Renders components. No hooks (except useRegisterBottomSheet) │
└──────────────────────────────────────────────────────────────┘
          │ props
          ▼
┌──────────────────────────────────────────────────────────────┐
│  COMPONENTS                                                  │
│  Dumb, reusable UI pieces. Props-driven. No business logic.  │
│  Use Controller for form fields. Haptics on interactions.     │
└──────────────────────────────────────────────────────────────┘
```

```
DOMAIN HOOK                    FORM HOOKS (separate)
  ├── useTRPC queries           ├── useForm + zodResolver
  ├── mutations                 ├── watch, setValue, reset
  ├── store (UI state)          ├── Conditional fields
  ├── onSuccess handlers        └── handleSubmit with haptics
  └── returns unified API             (no mutation calls)
```

---

## tRPC queries and mutations

Use `useTRPC()` — query keys and options are auto-generated:

```typescript
// hooks/use-rounds.ts
import { useTRPC } from "@bokendell/golf-client/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useRounds() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query
  const roundsQuery = useQuery(trpc.rounds.list.queryOptions());

  // Mutation with cache invalidation
  const createMutation = useMutation(
    trpc.rounds.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.rounds.list.queryKey() });
      },
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

**Query invalidation:** always use `trpc.{router}.{procedure}.queryKey()` — never hardcode string keys.

---

## Domain hook pattern

The domain hook composes everything and returns a unified API for the container:

```typescript
// hooks/use-active-round.ts
export function useActiveRound(roundId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const store = useRoundUIStore();

  // Stable selectors
  const setCurrentHole = useRoundUIStore((s) => s.setCurrentHole);
  const setPendingSyncCount = useRoundUIStore((s) => s.setPendingSyncCount);

  // Server state
  const roundQuery = useQuery(trpc.rounds.getById.queryOptions({ id: roundId }));
  const submitMutation = useMutation(trpc.rounds.submitScores.mutationOptions());

  // Pending mutation count tracking
  const pendingMutations = useIsMutating();
  useEffect(() => {
    setPendingSyncCount(pendingMutations);
  }, [pendingMutations, setPendingSyncCount]);

  // Optimistic update + mutation
  const handleSubmitScores = useCallback(
    (data: ScoreEntryFormData) => {
      // 1. Optimistic update
      queryClient.setQueryData(
        trpc.rounds.getById.queryKey({ id: roundId }),
        (old: RoundDetail | undefined) => {
          if (!old) return old;
          return { ...old, scores: mergeScores(old.scores, data) };
        },
      );

      // 2. Advance to next hole immediately
      setCurrentHole(Math.min(data.holeNumber + 1, roundQuery.data?.totalHoles ?? 18));

      // 3. Submit to server
      submitMutation.mutate(
        { id: roundId, ...data },
        {
          onError: () => {
            // Roll back on failure
            queryClient.invalidateQueries({
              queryKey: trpc.rounds.getById.queryKey({ id: roundId }),
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          },
          onSettled: () => {
            // Always re-validate for server truth
            queryClient.invalidateQueries({
              queryKey: trpc.rounds.getById.queryKey({ id: roundId }),
            });
          },
        },
      );
    },
    [trpc, queryClient, roundId, setCurrentHole, submitMutation, roundQuery.data],
  );

  return {
    round: roundQuery.data,
    isLoading: roundQuery.isLoading,
    currentHole: store.currentHole,
    pendingSyncCount: store.pendingSyncCount,
    handleSubmitScores,
    isSubmitting: submitMutation.isPending,
    openScoreEntry: store.openScoreEntry,
    closeScoreEntry: store.closeScoreEntry,
  };
}
```

---

## Form hook pattern

Form hooks live in `hooks/forms/` — they never call mutations:

```typescript
// hooks/forms/use-score-entry-form.ts
import type { ScoreEntryFormData } from "../../types";
import type { ScoreEntryFormOptions } from "../../types";

export function useScoreEntryForm({ holeNumber, players, holePar, existingStrokes, onSubmit }: ScoreEntryFormOptions) {
  const makeDefaults = () => ({
    holeNumber,
    par: holePar,
    scores: players.map((p) => ({
      roundPlayerId: p.id,
      strokes: existingStrokes[p.id] ?? holePar,
      putts: null,
      fairwayHit: null,
      gir: null,
    })),
  });

  const form = useForm<ScoreEntryFormData>({
    resolver: zodResolver(scoreEntrySchema),
    defaultValues: makeDefaults(),
  });

  // Reset when hole changes to pick up existing scores
  useEffect(() => {
    form.reset(makeDefaults());
  // eslint-disable-next-line: intentional reset on hole/par change only
  }, [holeNumber, holePar]);

  // Wrapped submit with haptic feedback — calls onSubmit from domain hook
  const handleSubmit = useCallback(() => {
    form.handleSubmit((data) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSubmit(data); // domain hook handles the mutation
    })();
  }, [form, onSubmit]);

  return {
    control: form.control,
    errors: form.formState.errors,
    isSubmitting: form.formState.isSubmitting,
    handleSubmit,
    watch: form.watch,
    setValue: form.setValue,
  };
}
```

**Rules:**
- `onSubmit` prop comes from domain hook (which calls the mutation)
- Form hook never imports or calls mutations directly
- Reset on dialog close with 300ms delay: `setTimeout(() => form.reset(), 300)`
- Haptics fire inside `handleSubmit` before calling `onSubmit`

---

## Zustand store pattern

### Non-persisted (session state — most stores)

```typescript
// stores/round-ui-store.ts
import type { RoundUIState } from "../types";
import { INITIAL_HOLE } from "../constants";

const initialState = {
  currentHole: INITIAL_HOLE,
  scoreEntryOpen: false,
  scoreEntryHole: null as number | null,
  pendingSyncCount: 0,
  latestAiSummary: null as AiSummary | null,
};

export const useRoundUIStore = create<RoundUIState>()((set) => ({
  ...initialState,
  setCurrentHole: (hole) => set({ currentHole: hole }),
  openScoreEntry: (holeNumber) => set({ scoreEntryOpen: true, scoreEntryHole: holeNumber }),
  closeScoreEntry: () => set({ scoreEntryOpen: false }),
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
  setLatestAiSummary: (summary) => set({ latestAiSummary: summary }),
  dismissLatestAiSummary: () => set({ latestAiSummary: null }),
  reset: () => set(initialState),
}));
```

### Persisted (user preferences)

```typescript
// stores/goals-ui-store.ts
import type { GoalsUIState } from "../types";
import { DEFAULT_SORT_ORDER, DEFAULT_GROUP_BY } from "../constants";

const initialState = {
  sortOrder: DEFAULT_SORT_ORDER,
  groupBy: DEFAULT_GROUP_BY,
  expandAllByDefault: false,
};

export const useGoalsUIStore = create<GoalsUIState>()(
  persist(
    (set) => ({
      ...initialState,
      setSortOrder: (order) => set({ sortOrder: order }),
      setGroupBy: (groupBy) => set({ groupBy }),
      setExpandAllByDefault: (expand) => set({ expandAllByDefault: expand }),
      reset: () => set(initialState),
    }),
    {
      name: "goals-ui-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

**Decision:** Persist when preferences should survive app restart (sort order, view mode, expand-all). Don't persist ephemeral state (which score entry hole is open, animation state).

---

## Zod schemas

```typescript
// schemas/score-entry.schema.ts
import { z } from "zod";

export const playerScoreSchema = z.object({
  roundPlayerId: z.string().uuid(),
  strokes: z.number().int().min(1).max(15),
  putts: z.number().int().min(0).nullable(),   // .nullable() not .optional()
  fairwayHit: z.boolean().nullable(),
  gir: z.boolean().nullable(),
});

export const scoreEntrySchema = z.object({
  holeNumber: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  scores: z.array(playerScoreSchema).min(1),
});
```

**Always `.nullable()` not `.optional()`** — React Hook Form always provides values for registered fields, `undefined` causes issues.

---

## Container pattern

Container = orchestrator. All logic, no JSX beyond composition:

```typescript
// containers/round-container.tsx
export function RoundContainer() {
  const { id: roundId } = useLocalSearchParams<{ id: string }>();
  const { data: session, isPending } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // Hide tab bar for immersive screens
  const setTabBarHidden = useTabBarStore((s) => s.setHidden);
  useEffect(() => {
    setTabBarHidden(true);
    return () => setTabBarHidden(false);
  }, [setTabBarHidden]);

  // Auth guard
  if (isPending) return <LoadingScreen />;
  if (!session) {
    useDeepLinkStore.getState().setPendingHref(pathname as Href);
    return <Redirect href="/login" />;
  }

  const state = useActiveRound(roundId);

  return (
    <>
      <ActiveRoundScreen
        round={state.round}
        isLoading={state.isLoading}
        currentHole={state.currentHole}
        onSubmitScores={state.handleSubmitScores}
        isSubmitting={state.isSubmitting}
        onSelectHole={state.openScoreEntry}
        pendingSyncCount={state.pendingSyncCount}
      />

      <ScoreEntrySheet
        open={state.scoreEntryOpen}
        holeNumber={state.scoreEntryHole}
        onClose={state.closeScoreEntry}
        onSubmit={state.handleSubmitScores}
      />
    </>
  );
}
```

---

## Screen pattern

Screen = pure presentation. Props only, no hooks (except `useRegisterBottomSheet` in sheets):

```typescript
// screens/active-round-screen.tsx
import type { ActiveRoundScreenProps } from "../types";

export function ActiveRoundScreen({
  round,
  isLoading,
  currentHole,
  onSubmitScores,
  isSubmitting,
  onSelectHole,
  pendingSyncCount,
}: ActiveRoundScreenProps) {
  if (isLoading) return <RoundSkeleton />;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <RoundHeader
        holeName={round?.courseName}
        pendingSyncCount={pendingSyncCount}
      />
      <ScoreCard
        holes={round?.holes ?? []}
        currentHole={currentHole}
        onSelectHole={onSelectHole}
      />
    </SafeAreaView>
  );
}
```

---

## Component pattern

Components are dumb. One per file. Props-driven. Haptics on interactions:

```typescript
// components/score-card.tsx
import type { ScoreCardProps } from "../types";
import { HOLE_HEIGHT } from "../constants";

export function ScoreCard({ holes, currentHole, onSelectHole }: ScoreCardProps) {
  const handlePress = (holeNumber: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectHole(holeNumber);
  };

  return (
    <FlatList
      data={holes}
      keyExtractor={(h) => String(h.holeNumber)}
      renderItem={({ item }) => (
        <HoleRow
          hole={item}
          isActive={item.holeNumber === currentHole}
          onPress={() => handlePress(item.holeNumber)}
        />
      )}
      getItemLayout={(_, index) => ({ length: HOLE_HEIGHT, offset: HOLE_HEIGHT * index, index })}
    />
  );
}
```

---

## types.ts and constants.ts

Every package has these two root files. Nothing else exports types or constants:

```typescript
// types.ts
import type { RoundDetailResponseSchema } from "@bokendell/golf-client";
import type { UseFormReturn } from "react-hook-form";
import type { ScoreEntryFormData } from "./schemas/score-entry.schema";

export interface ActiveRoundScreenProps {
  round: RoundDetailResponseSchema | undefined;
  isLoading: boolean;
  currentHole: number;
  pendingSyncCount: number;
  onSubmitScores: (data: ScoreEntryFormData) => void;
  isSubmitting: boolean;
  onSelectHole: (holeNumber: number) => void;
}

export interface RoundUIState {
  currentHole: number;
  scoreEntryOpen: boolean;
  scoreEntryHole: number | null;
  pendingSyncCount: number;
  latestAiSummary: AiSummary | null;
  setCurrentHole: (hole: number) => void;
  openScoreEntry: (holeNumber: number) => void;
  closeScoreEntry: () => void;
  setPendingSyncCount: (count: number) => void;
  setLatestAiSummary: (summary: AiSummary) => void;
  dismissLatestAiSummary: () => void;
  reset: () => void;
}
```

```typescript
// constants.ts
export const INITIAL_HOLE = 1;
export const MAX_HOLES = 18;
export const HOLE_HEIGHT = 56;
export const SCORE_ENTRY_SNAP_POINTS = ["50%", "90%"] as const;
export const FORM_RESET_DELAY_MS = 300;
```

---

## Bottom sheet management

Every bottom sheet calls `useRegisterBottomSheet` to auto-hide the tab bar:

```typescript
// components/score-entry-sheet.tsx
import { useRegisterBottomSheet } from "../../site/hooks/use-register-bottom-sheet";

export function ScoreEntrySheet({ open, onClose, onSubmit, holeNumber }: ScoreEntrySheetProps) {
  useRegisterBottomSheet(open); // hides tab bar when open

  const { control, errors, handleSubmit } = useScoreEntryForm({
    open,
    holeNumber: holeNumber ?? 1,
    onSubmit,
  });

  return (
    <BottomSheet open={open} onOpenChange={onClose} snapPoints={SCORE_ENTRY_SNAP_POINTS}>
      <BottomSheetContent>
        {/* form fields using Controller */}
      </BottomSheetContent>
    </BottomSheet>
  );
}
```

---

## Utils pattern

Any logic that can be extracted must go in `utils/` with tests:

```typescript
// utils/merge-scores.ts
import type { RoundScore, ScoreEntryFormData } from "../types";

export function mergeScores(existing: RoundScore[], incoming: ScoreEntryFormData): RoundScore[] {
  const filtered = existing.filter(
    (s) =>
      !(
        incoming.scores.some((ns) => ns.roundPlayerId === s.roundPlayerId) &&
        s.holeNumber === incoming.holeNumber
      ),
  );
  return [...filtered, ...incoming.scores.map(toRoundScore)];
}
```

```typescript
// utils/merge-scores.test.ts
import { describe, expect, it } from "vitest";
import { mergeScores } from "./merge-scores";

describe("mergeScores", () => {
  it("replaces existing score for same hole and player", () => {
    // ...
  });
  it("preserves scores for other holes", () => {
    // ...
  });
});
```

---

## Realtime (Ably)

If the domain needs realtime updates, use a channel hook:

```typescript
// hooks/use-round-channel.ts
export function useRoundChannel(roundId: string) {
  const { lastEvent } = useAblyChannel(`round:${roundId}`);
  return { lastEvent };
}
```

In the domain hook, handle events with `useEffect`:

```typescript
useEffect(() => {
  if (!lastEvent) return;

  if (lastEvent.name === ROUND_EVENTS.SCORE_SUBMITTED) {
    queryClient.invalidateQueries({
      queryKey: trpc.rounds.getById.queryKey({ id: roundId }),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}, [lastEvent, queryClient, trpc, roundId]);
```

Event names live in `constants.ts`, not inline strings.

---

## Navigation

Expo Router file-based routing. Route params via `useLocalSearchParams`:

```typescript
// Typed params
const { id } = useLocalSearchParams<{ id: string }>();

// Navigate
const router = useRouter();
router.push({ pathname: "/round/[id]/chat", params: { id: roundId } });
router.back();
```

Container handles auth guards:

```typescript
const { data: session, isPending } = useSession();
if (isPending) return <LoadingScreen />;
if (!session) return <Redirect href="/login" />;
```

---

## Root provider order

```typescript
// Root layout
<GestureHandlerRootView style={{ flex: 1 }}>
  <KeyboardProvider>
    <BottomSheetVisibilityProvider>
      <QueryProvider>
        {children}
      </QueryProvider>
    </BottomSheetVisibilityProvider>
  </KeyboardProvider>
</GestureHandlerRootView>
```

---

## Rules summary

| Rule | Detail |
|------|--------|
| Types | All in `types.ts` — never inline |
| Constants | All in `constants.ts` — never inline |
| One component per file | No exceptions |
| Business logic | Extract to `utils/` with tests |
| Mutations | Called from domain hook only — never from form hooks or components |
| `.nullable()` | Always, never `.optional()` for RHF fields |
| Haptics | On every user interaction — `Light` for navigation, `Medium` for submit, `Success`/`Error` for async results |
| Form reset | `setTimeout(() => form.reset(), 300)` on dialog close |
| Stores | Non-persisted by default; persist only user preferences |
| Query invalidation | `trpc.{router}.{procedure}.queryKey()` — never hardcoded strings |
| Realtime | Use channel hook + `useEffect` in domain hook; event names in `constants.ts` |

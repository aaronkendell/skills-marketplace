# Mobile Review Criteria (Expo + React Native)

> Full reference: `docs/context/patterns/mobile.md`

## Component architecture (same rules as frontend, plus mobile-specific)

- [ ] BLOCKING: Screen files contain no hook calls except: `useSafeAreaInsets`, `useTabBarPadding`, `useRegisterBottomSheet`
- [ ] BLOCKING: Container files call exactly one domain hook (`use{Domain}`)
- [ ] BLOCKING: Container renders screen(s) and sheet/dialog overlays — no direct UI rendering of data
- [ ] IMPORTANT: Skeleton loading components in `components/skeleton/` — not inline in screens

## Haptics

- [ ] IMPORTANT: All interactive elements trigger haptic feedback (`Haptics.impactAsync` or `Haptics.notificationAsync`)
- [ ] IMPORTANT: Form submit uses `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)`
- [ ] IMPORTANT: Mutation success uses `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`

## Navigation

- [ ] IMPORTANT: Params typed via `useLocalSearchParams<{ id: string }>()`
- [ ] IMPORTANT: Auth guards redirect via `useRouter().replace('/login')` — not `push`

## Forms

- [ ] BLOCKING: Form schemas use `.nullable()` not `.optional()` for optional fields
- [ ] BLOCKING: Form hooks live in `hooks/forms/` — separate from domain hook
- [ ] IMPORTANT: Forms reset after successful submission or sheet close

## Stores

- [ ] BLOCKING: Zustand stores hold UI state only (no React Query data, no API calls)
- [ ] IMPORTANT: Store named `use{Domain}UIStore` and file at `stores/{domain}-ui-store.ts`

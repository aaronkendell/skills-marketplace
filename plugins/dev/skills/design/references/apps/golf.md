# Golf (Fairway) — Design Reference

> **Aesthetic:** "Modern Country Club Meets Glass"
> **Tone:** Refined, premium, sporty-luxe. A modern private club's member app.
> **NOT:** Corporate. NOT gamified. NOT social-media-ish.

## Full Design Docs

For complete specifications, read these files from the codebase:
- `docs/apps/golf/design/design-system.md` — Complete token reference (colors, typography, spacing, shadows, glass)
- `docs/apps/golf/design/component-catalog.md` — All component specs, tiers, props, and variants
- `docs/apps/golf/design/screen-patterns.md` — Screen wireframes, layouts, navigation architecture
- `docs/apps/golf/design/interaction-patterns.md` — Animations, haptics, gestures
- `docs/apps/golf/design/native-component-strategy.md` — Interop patterns (cssInterop, Host wrapper)

## Token Implementation Files

| File | Role |
|------|------|
| `packages/shared/mobile-ui/src/lib/golf-theme.ts` | Source of truth — COLORS, TYPOGRAPHY, RADIUS, SPACING |
| `packages/shared/mobile-ui/src/styles/global.css` | CSS custom properties for NativeWind |

## Quick Token Reference

### Brand Colors (OKLch)
- **Gold** (`--color-gold`): Primary CTA, wins, highlights — `oklch(0.78 0.138 75)`
- **Sage** (`--color-sage`): Secondary actions, pars — `oklch(0.68 0.10 155)`
- **Background (dark)**: Deep blue-charcoal — `oklch(0.12 0.006 260)`
- **Foreground (dark)**: Warm ivory — `oklch(0.93 0.008 80)`

### Score Colors
| Score | Token | Color |
|-------|-------|-------|
| Eagle+ | `--color-score-eagle` | Celebratory gold |
| Birdie | `--color-score-birdie` | Positive teal |
| Par | `--color-score-par` | Neutral (default text) |
| Bogey | `--color-score-bogey` | Caution warm orange |
| Double+ | `--color-score-double` | Muted red |

### Typography (Three-Voice System)
| Voice | Font | Usage |
|-------|------|-------|
| Display | Instrument Serif | Screen titles, hero text, brand moments ONLY |
| Body | Outfit | All readable text, labels, navigation |
| Data | DM Mono | Scores, money, stats, badges, timestamps |

### Glass Effects
- Uses `expo-glass-effect` for native iOS glass
- Glass tokens: `--glass-bg`, `--glass-hover`, `--glass-border`, `--glass-glow`
- Dark: subtle white-tinted borders, content floats above dark
- Light: subtle shadows, translucent white backgrounds

### Component Tiers
| Tier | Location | Scope |
|------|----------|-------|
| Shared | `packages/shared/mobile-ui/src/` | Cross-app (GlassCard, Button, Avatar) |
| App Universal | `apps/golf/mobile/src/lib/components/` | Golf-wide (ScoreDisplay, PlayerChip) |
| Domain | `apps/golf/mobile/src/packages/{domain}/components/` | Single domain |

### Screen Architecture
Container → Screen → Component pattern. Screens are pure presentation (no hooks). Containers compose hooks and pass props down.

### Layout Rules (Mobile)
- Horizontal padding: 20px (`px-5`)
- Tab bar clearance: 92px bottom padding
- Section gap: 24px (`gap-6`)
- Card gap: 10-12px (`gap-2.5` or `gap-3`)
- Floating glass tab bar: `rounded-[28px]`, 16px margins, 24px from bottom

### Haptic Feedback
Every interactive element must include haptics:
- Light: buttons, tabs, toggles, steppers
- Medium: form submit, score submit
- Heavy: long press actions
- Notification Success: round complete, score confirmed
- Notification Error: validation fail

### Accessibility
- `accessibilityLabel` on all interactive elements
- 44x44px minimum touch targets
- Color never sole indicator (always pair with text/icon)
- Respect `isReduceMotionEnabled` for animations
- WCAG AA contrast (4.5:1 body, 3:1 large text)

### Admin (Web)
- Uses Tailwind v4 + shadcn components from `packages/shared/ui/`
- Should share golf brand colors but adapted for desktop (no glass effects)
- Refine admin framework for data management screens

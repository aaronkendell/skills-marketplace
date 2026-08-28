# Tailwind Config Sharing Across Apps

## Current State

All web apps use nearly identical Tailwind v4 configs:

```typescript
// Every web app's tailwind.config.ts
export default {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/shared/ui/src/**/*.{ts,tsx}",  // shared components
  ],
} satisfies Config;
```

## What Can Be Shared

| Layer | Shareable? | How |
|-------|-----------|-----|
| **Content paths** | Yes | All point to `packages/shared/ui/` |
| **Base tokens** (spacing, radius, shadows) | Yes | Shared Tailwind preset |
| **Brand colors** | Per-app | Each app overrides colors in its CSS |
| **Typography** | Per-app | Each app has its own font stack |
| **Dark mode** | Yes | Same mechanism (`class` strategy) |

## Mobile (NativeWind)

Mobile apps use NativeWind (Tailwind for React Native). The config is different:
- Lives in `apps/mobile/tailwind.config.ts`
- Content includes mobile-ui: `"../../packages/shared/mobile-ui/src/**/*.{ts,tsx}"`
- Same token VALUES as web, different config FORMAT

## Approach: Shared Design Tokens Package

If you want to fully share tokens, create `packages/shared/design-tokens/`:

```
packages/shared/design-tokens/
├── src/
│   ├── colors.ts      # Brand-agnostic base colors
│   ├── spacing.ts     # Consistent spacing scale
│   ├── typography.ts  # Font scale (not font families)
│   └── index.ts
├── package.json
└── tsconfig.json
```

Each app imports and extends with its brand:

```typescript
// apps/admin/tailwind.config.ts
import { baseTokens } from "@bokendell/design-tokens";

export default {
  theme: {
    extend: {
      ...baseTokens,
      colors: {
        ...baseTokens.colors,
        gold: "oklch(0.78 0.138 75)",  // Golf-specific
        sage: "oklch(0.68 0.10 155)",  // Golf-specific
      },
    },
  },
};
```

This is a FUTURE optimization — not needed now. The current per-app configs work fine.

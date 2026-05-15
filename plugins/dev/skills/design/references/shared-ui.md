# Shared UI Library Reference

The shared UI library lives at `packages/shared/ui/` and provides shadcn components used across all web apps (golf admin, portfolio app/admin, hive app).

## Before Building a New Component

Always check if it already exists:

```bash
ls packages/shared/ui/src/components/
```

## Component Sources

| Directory | Contains |
|-----------|----------|
| `packages/shared/ui/src/components/` | shadcn primitives (Button, Card, Dialog, etc.) |
| `packages/shared/ui/src/shadcn/` | shadcn configuration |
| `packages/shared/ui/src/hooks/` | Shared hooks (useMediaQuery, etc.) |
| `packages/shared/ui/src/styles/` | Shared CSS |
| `packages/shared/ui/src/theme/` | Theme utilities |

## Adding New shadcn Components

Use the shadcn CLI from the ui package:

```bash
cd packages/shared/ui
pnpm dlx shadcn@latest add <component-name>
```

The shadcn skill (already installed) reads `components.json` and knows the project setup.

## Mobile UI Library

For React Native components, the shared library is at `packages/shared/mobile-ui/`:

| Directory | Contains |
|-----------|----------|
| `packages/shared/mobile-ui/src/components/` | Native components (GlassCard, Button, Avatar) |
| `packages/shared/mobile-ui/src/styles/` | CSS variables (global.css) |
| `packages/shared/mobile-ui/src/lib/` | Theme utilities, golf-theme.ts |

## When to Use Which

| Need | Library | Import |
|------|---------|--------|
| Web component (admin, dashboard) | `packages/shared/ui` | `@bokendell/ui` |
| Mobile component (Expo app) | `packages/shared/mobile-ui` | `@bokendell/mobile-ui` |
| Refine admin component | `packages/shared/ui/src/refine/` | `@bokendell/ui/refine` |

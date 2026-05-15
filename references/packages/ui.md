# @bokendell/shared-ui

Location: `packages/shared/ui/`

## What it exports
Shadcn/ui components built on Radix UI primitives, styled with Tailwind CSS 4.

- Button, Input, Label, Textarea, Select, Checkbox, Switch
- Dialog, Sheet, Drawer, Popover, Tooltip
- Card, Badge, Avatar, Separator
- Form (React Hook Form integration)
- Toast / Sonner notifications
- Table, DataTable

## How to use
```typescript
import { Button } from "@bokendell/shared-ui/button";
import { Dialog, DialogContent } from "@bokendell/shared-ui/dialog";
```

Imports use the package `exports` field — import individual components, not the barrel.

## Dependencies
- Radix UI primitives (`@radix-ui/*`)
- Tailwind CSS 4 (peer dependency — consumer must configure)
- `class-variance-authority`, `clsx`, `tailwind-merge`

## Notes
- Components are unstyled at the token level — apps apply their own Tailwind theme
- Do not add app-specific logic here; keep components generic

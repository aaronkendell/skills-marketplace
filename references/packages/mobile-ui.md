# @bokendell/mobile-ui — Agent Context

Location: `packages/shared/mobile-ui/`

## What it exports
Shared React Native component library used by all mobile apps (golf, goals, home-videos, offline). Built on `rn-primitives` and `@expo/ui`, styled with NativeWind.

**UI components**: Button, Input, Label, Textarea, Select, Checkbox, Switch, Dialog, Sheet, BottomSheet, Popover, Tooltip, Card, Badge, Avatar, Separator, Accordion, Alert, AlertDialog, Tabs, DatePicker, DropdownMenu, ContextMenu, Progress, RadioGroup, Toggle, ToggleGroup, Spinner, Skeleton, ErrorBoundary

**Specialized components**: GlassCard, GlassIconButton, GlassView, ScoreDisplay, RelativeScore, MoneyDisplay, Icon, Cursor

**Auth components**: re-exported auth UI pieces

**Theme**: `golf-theme`, glass utilities, NativeWind theme config

**Portal**: `PortalHost` (must be in root layout)

## How to use
```typescript
import { Button } from "@bokendell/mobile-ui";
import { BottomSheet } from "@bokendell/mobile-ui";
import { PortalHost } from "@bokendell/mobile-ui"; // in root layout
```

## Notes
- This is the mobile equivalent of `@bokendell/shared-ui` (web)
- Do not add app-specific logic here — keep components generic and reusable
- See `context/patterns/mobile.md` for how components are used in the mobile architecture

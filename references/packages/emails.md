# @bokendell/emails — Agent Context

Location: `packages/shared/emails/`

## What it exports
Email sending utilities with React Email templates and Resend as the delivery provider.

- `sendEmail(opts)` — send a transactional email
- `getEmailClient()` — configured Resend client
- `isEmailConfigured()` — returns false in test environments
- Templates: re-exported from `./templates` (magic link, notifications, etc.)
- Components: re-exported from `./components` (layout, typography, etc.)

## How to use
```typescript
import { sendEmail } from "@bokendell/emails";

await sendEmail({
  to: user.email,
  subject: "Your magic link",
  template: <MagicLinkEmail url={url} />,
});
```

## Notes
- Uses Resend for delivery
- Templates are React Email components
- `isEmailConfigured()` → skip sending in tests/local dev without credentials

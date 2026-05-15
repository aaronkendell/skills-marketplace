# @bokendell/push-notifications — Agent Context

Location: `packages/shared/push-notifications/`

## What it exports
Expo push notification utilities for sending notifications to mobile devices.

- `sendPushNotification(opts)` — send a push notification via Expo Push Service
- `getExpoPushClient()` — configured Expo push client
- `PushError`, `PushErrorCode` — typed error classes

## How to use
```typescript
import { sendPushNotification } from "@bokendell/push-notifications";

await sendPushNotification({
  to: user.expoPushToken,
  title: "New message",
  body: "You have a new notification",
  data: { type: "round_invite", roundId: "..." },
});
```

## Notes
- Uses Expo Push Service (works for both iOS APNs and Android FCM)
- Push tokens are stored per user in the app's DB
- Notification dispatch is done via Inngest tasks, not inline in request handlers

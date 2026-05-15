# @bokendell/redis

Location: `packages/shared/redis/`

## What it exports
Upstash Redis utilities for caching, rate limiting, and pub/sub.

- `createRedisClient()` — configured Upstash Redis client
- `createRateLimiter(opts)` — sliding window rate limiter
- `type RedisClient` — typed client

## How to use
```typescript
import { createRedisClient } from "@bokendell/redis";

const redis = createRedisClient();
await redis.set("key", "value", { ex: 60 });
const value = await redis.get("key");
```

## Dependencies
- `@upstash/redis`
- `@upstash/ratelimit`

## Environment variables required
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Notes
- Uses Upstash HTTP driver (edge-compatible, no TCP)
- Rate limiter uses sliding window algorithm by default

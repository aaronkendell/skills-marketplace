# @bokendell/storage — Agent Context

Location: `packages/shared/storage/`

## What it exports
Cloudflare R2 storage utilities shared across all apps. Handles presigned URLs, file validation, storage key generation, and CDN URL transforms.

- `createR2Client()` — configured R2 client
- `generatePresignedUploadUrl(opts)` — S3-compatible presigned URL for direct browser upload
- `generatePresignedDownloadUrl(opts)` — presigned URL for private file access
- `generateStorageKey(opts)` — deterministic storage key (`{app}/{env}/{category}/{id}.{ext}`)
- `getPublicUrl`, `transformToCdnUrl` — public/CDN URL helpers
- `validateFileType`, `validateFileSize` — file validation before upload
- `ALLOWED_MIME_TYPES`, `SUGGESTED_SIZE_LIMITS` — constants per file category

## How to use
```typescript
import { createR2Client, generatePresignedUploadUrl, generateStorageKey } from "@bokendell/storage";

const r2 = createR2Client();
const key = generateStorageKey({ app: "golf", category: "images", id: fileId, ext: "jpg" });
const { url, fields } = await generatePresignedUploadUrl({ key, contentType: "image/jpeg" });
```

## Notes
- Pattern: frontend requests presigned URL from API → uploads directly to R2 → API saves key to DB
- `getBucketName` resolves the correct bucket per app + environment
- `isR2Configured()` returns false in test environments (skip storage in tests)

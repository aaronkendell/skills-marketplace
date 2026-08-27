# Grading — domain-vendor-leak

This case measures RECALL against violations planted on purpose. Score each
independently; do not reward prose, only findings.

The response MUST identify all three:

1. **Vendor SDK imported directly into domain code.** `import { Resend } from "resend"`
   in a domain service. Domain code must go through the `@bokendell/emails` package.
   Credit only if the response names the direct vendor import as the problem — naming
   the package `resend` without saying it may not be imported here does not count.
2. **Raw `process.env` access.** Both `process.env.RESEND_API_KEY` and
   `process.env.FROM_EMAIL`. All env access goes through zod-validated config. Credit
   if either occurrence is called out as an env-access violation.
3. **Swallowed error.** The bare `catch {}` discards the failure silently. Credit if
   the response flags the empty catch as swallowing the error.

Do NOT deduct for extra findings that are correct (e.g. templating a user id into
HTML). Do deduct if the response claims the file is fine, or if it "fixes" the file
instead of reviewing it.

Score = fraction of the three planted violations correctly identified.

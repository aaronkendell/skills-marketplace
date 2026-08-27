# Grading — api-contract

RECALL against planted violations. Score each independently.

The response MUST identify all three:

1. **Raw `fetch` to the app's own backend.** `fetch(`${API_URL}/api/v1/rounds/...)`
   bypasses the typed oRPC client and loses the contract. This is the exact shape the
   `no-raw-backend-fetch` arch rule bans. Credit only if the response says the call
   must go through the typed client.
2. **Unvalidated payload written to the database.** The response body is `as`-cast to
   `{ strokes: number }` and inserted with no zod validation at the trust boundary.
3. **List route with no pagination or standard envelope.** `listRounds` selects every
   row, unbounded, and also ignores its `userId` argument entirely — flagging either
   the missing pagination or the unfiltered/unscoped query counts.

Do NOT deduct for extra correct findings. Do deduct for "looks fine" or for
rewriting instead of reviewing.

Score = fraction of the three planted violations correctly identified.

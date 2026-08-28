# AI Patterns (Mastra + aiService funnel)

All LLM, agent, voice, and workflow execution flows through one entry point: `aiService` (in `@bokendell/golf-domains/ai`). Every call site — chat stream, voice transcribe, Inngest job, sub-agent — goes through the funnel so access gating, metering, memory, model resolution, and tracing happen in one place.

The unification design is documented at `docs/superpowers/specs/2026-04-25-ai-service-unification-design.md` and the implementation plan at `docs/superpowers/plans/2026-04-25-ai-service-unification-plan.md`. This file is the working pattern reference — read this when you're touching AI code, then read the spec for the deeper "why".

---

## The funnel

```
call site
  └─> aiService.{stream, generate, transcribe, threads, models}
        └─> mastraFor(modelString)  ← composition closure
              └─> getMastra({ model, meteringService, agentDeps })
                    └─> Mastra instance
                          └─> orchestrator agent (golf-assistant)
                                ├─ tools (request_clarification, read_*, submit_hole_scores, ...)
                                └─ sub-agents (caddie, stats, scorekeeper, gameSetup, disputeMediator)
```

**Never bypass the funnel.** No direct `agent.generate(...)`, no direct fetch to OpenAI/Anthropic. If you find yourself reaching for `@mastra/core` outside the `golf-domains/ai` module, stop — wire it through `aiService` instead.

The lint rule (`noRestrictedImports`) enforces this for new code. Existing call sites that bypass the funnel are tracked as defects in the unification plan.

---

## Tool registration — the late-bind pattern

Tools that need application services (e.g. `submit_hole_scores` needs `roundService`) are wired through a **late-bind** in the API composition root. This is the most surprising part of the system; read carefully.

### Why late-bind

`apps/api/src/lib/services/round.service-factory.ts` depends on `aiService.threads` (for thread injection on round events). `ai.service-factory.ts` therefore **cannot** import `round.service-factory.ts` directly — it would form an import cycle.

But the orchestrator agent's `submit_hole_scores` and `correct_hole_score` tools require `roundService` to function. If `getMastra` is called without `agentDeps.roundService`, `createGolfAssistant` falls into the base-tools branch and those action tools are never registered.

### How it works

```ts
// apps/api/src/lib/services/ai.service-factory.ts
let lateBoundRoundService: RoundService | undefined;
export function bindRoundServiceForAi(rs: RoundService): void {
  lateBoundRoundService = rs;
}

export const aiService = createAiService({
  mastraFor: (modelString) => getMastra({
    model: modelString,
    meteringService: aiMeteringService,
    agentDeps: lateBoundRoundService ? { roundService: lateBoundRoundService } : undefined,
  }),
  // ...
});

// apps/api/src/lib/services/round.service-factory.ts
import { bindRoundServiceForAi } from "./ai.service-factory";
export const roundService = createRoundService({ /* ... */ });
bindRoundServiceForAi(roundService);  // ← runs at module load
```

The order of operations:
1. API server starts; module imports begin
2. `ai.service-factory.ts` loads → `aiService` is constructed; `mastraFor` is a closure that reads `lateBoundRoundService` *at call time* (still undefined here)
3. `round.service-factory.ts` loads → `roundService` is constructed → `bindRoundServiceForAi(roundService)` sets the late-bound value
4. First chat request arrives → `aiService.stream()` calls `mastraFor(modelString)` → reads the late-bound (now defined) → builds an orchestrator with the action tools

### Why this defect is invisible without tests

Mastra **still emits `tool-input-start` events** for the missing tools (the schema reaches the model through some other path). The streaming response shows `toolName: "submit_hole_scores"` and the args being assembled. Then `tool-output-error: {"name":"ToolNotFoundError"}` fires, but the parser collapses tool-call records to `chat_tool_calls` and (before the fix in `ai.service.ts`) defaulted to `status="success"` when no matching tool result existed. So `chat_tool_calls` showed `submit_hole_scores | success` while `hole_scores` was empty. **The only signal that anything was wrong was a downstream consistency check.**

Two regression tests pin the fix:
- `packages/domains/src/packages/ai/infrastructure/mastra/agents/golf-assistant.test.ts` — domain contract: `roundService` controls tool registration
- `apps/api/src/lib/services/ai-service-factory.wiring.test.ts` — composition-root contract: importing `round.service-factory.ts` triggers the bind

If you ever add another tool that depends on a service which depends back on `aiService`, use the same pattern: late-bound setter exposed by `ai.service-factory.ts`, called from the dependency's factory module.

---

## Tools — `createMeteredTool` is mandatory

Every tool in the AI surface MUST go through `createMeteredTool` (in `packages/domains/src/packages/ai/infrastructure/mastra/metered-tool.ts`). It's a thin wrapper over Mastra's `createTool` that:

- Pulls `userId` from `RequestContext` (set by the parent runner) so tools never have to know the context-key string
- Will eventually wire metering (currently metering happens in the output processor — see "Metering" below)

**Banned by lint:** `import { createTool } from "@mastra/core/tools"` outside the `metered-tool.ts` module itself.

```ts
// packages/domains/.../tools/action-tools/submit-hole-scores.tool.ts
export function createSubmitHoleScoresTool(roundService: RoundService) {
  return createMeteredTool({
    id: "submit_hole_scores",
    description: "...",
    inputSchema: z.object({ /* ... */ }),
    execute: async (input, helpers) => {
      const userId = getUserIdFromContext(helpers.ctx, "submit_hole_scores");
      // ... use roundService
    },
  });
}
```

### No tool-nesting

Tools are PURE. **A tool MUST NOT call `agent.generate(...)` inside its execute body.** If a tool needs another LLM call, the calling code path calls `aiService.generate(...)` directly — not from inside a tool, and not via Mastra's `agents:` field on a parent agent.

Why: nested LLM calls bypass the metering output processor (orphaning ledger rows), hide spans from tracing, make access gating un-auditable, AND lose request-scoped context (round context, chatter identity, etc.) across the LLM hop because Mastra's nested-agent delegation only passes the parent-supplied prompt string, not the parent's full message list.

We collapsed the previous orchestrator → 4 sub-agent setup on 2026-04-25 for exactly this reason. The lint rule allowlists `@mastra/core` imports only inside the `golf-domains/ai` module — that's the seam.

### Schemas — keep them strict

Use plain `z.number()`, not `z.coerce.number()`. We tested all 6 frontier models (Claude Haiku 4.5, Sonnet 4.6, GPT-4.1, 4.1-mini, 4o, 4o-mini) on `submit_hole_scores` and they all emit typed args correctly **as long as the tool is actually registered**. Coercion turned out to be unnecessary — the original symptom was the missing-tool defect above, not model misbehavior.

If a future model genuinely emits stringified primitives, prefer fixing it at the Mastra level (file an upstream bug or wrap `validateToolInput`) rather than littering `z.coerce` across every tool. Mastra already coerces stringified arrays/objects via `coerceStringifiedJsonValues`; the gap is only for stringified primitives.

---

## Agents — single orchestrator + 2 standalone specialists

The system is a single orchestrator (`golf-assistant`) with a flat tool set, plus two standalone specialists invoked directly via `aiService.generate`:

| Agent | Role | Model | Invoked by |
|---|---|---|---|
| `golf-assistant` | Single orchestrator. All in-round chat (text + voice). | Conversational role (DB-resolved) | Chat stream, chat oRPC, 4 Inngest jobs |
| `rules-compiler-agent` | Compile golf-rules questions into structured answers. | Conversational | `ai.orpc.router.ts` rules-compile route |
| `dispute-mediator-agent` | Score dispute resolution. | Conversational | `ai-dispute-mediator.function.ts` Inngest job |

**No nested sub-agents.** Until 2026-04-25 the orchestrator delegated to four sub-agents (`caddie`, `stats`, `scorekeeper`, `gameSetup`) wired via Mastra's `agents:` map. That created synthetic `agent-*` tools whose execute body invoked another LLM. The pattern caused round-context loss across the LLM hop (the sub-agent only saw the parent's prompt string, not the pre-loaded round system message), and was responsible for the `hole_scores=0` defect documented above. We collapsed it: every tool that used to live on a sub-agent now lives on the orchestrator directly.

The two remaining standalone agents (`rules-compiler-agent`, `dispute-mediator-agent`) are NOT nested in the orchestrator's `agents:` map — they're called via `aiService.generate({ agentId: AGENT_IDS.x })` from Inngest/oRPC entry points. That's the correct pattern for "the parent decides it needs another LLM call": the parent calls `aiService.generate` directly from application code, NOT from inside a tool.

### Where to add things

- **New tool the orchestrator calls** → `infrastructure/tools/{action,read,setup}-tools/` + register in `golf-assistant.ts`
- **New top-level entry point** (Inngest job, voice flow, etc.) → call through `aiService.{generate, stream, transcribe}`
- **New specialist** (rare) → `infrastructure/mastra/agents/<name>.agent.ts`, register in `mastra.client.ts` (NOT in `golf-assistant.ts` `agents:` field), call via `aiService.generate({ agentId })` from application code

### Constructed via `createMeteredAgent`

`createMeteredAgent` (in `infrastructure/mastra/metered-agent.ts`) wraps `new Agent({...})` and ensures the metering output processor is always last in the chain. **All agents go through it.** Like with `createMeteredTool`, direct `new Agent()` outside the AI module is banned.

### Tool count discipline

The orchestrator currently has ~17 tools. Frontier models handle this comfortably (Anthropic's docs recommend keeping it under 30). If the count grows beyond 25, prefer collapsing similar tools (e.g. one `read_stats` with a `kind` enum) over reintroducing sub-agents — the context-loss problem is structural, not solvable by better prompting.

---

## Round-context injection

When a chat request includes a `roundId`, `apps/api/src/packages/ai/ai.stream.router.ts` pre-loads the round context and injects it as a system message at the **top level** of agent options:

```ts
body.context = [{ role: "system", content: contextMessage + voiceFlag }];
```

**Critical:** it must be `body.context = [...]`, not `body.options.context = [...]`. Mastra's signature is `agent.stream(messages, { context, memory, requestContext, ... })` — `context` is a top-level option. The earlier nested form was silently ignored, which is why the agent kept calling `read_round_context` on every message even though pre-load was running.

The context formatter (`mastra/prompts/round-context.prompt.ts`) emits a "Chatting User" section so the orchestrator knows which `roundPlayerId` to use for the current chatter without asking — eliminates the most common "which player are you?" clarification loop.

---

## Thread refs — `ThreadRef` discriminated union

Every `aiService.{generate, stream}` call takes a typed `thread: ThreadRef` instead of a raw string. The union is the single source of truth for both:

1. The Mastra thread key (memory continuity)
2. The `ai_usage_events.thread_source` ledger column (cost attribution)

```ts
// application/types/thread-ref.ts
type ThreadRef =
  | { source: "round"; roundId: string; userId: string }   // resolves to round_<roundId>_<userId>
  | { source: "general"; threadId: string }                 // resolves to <threadId> (caller-supplied UUID)
  | { source: "ephemeral" };                                // resolves to oneshot_<crypto-uuid>
```

**Resolver:** `infrastructure/mastra/thread-ref.ts` exports `resolveThreadKey(ref): string` and `resolveMemoryConfig(ref, userId, opts)`. **Never concatenate thread strings directly** — use the resolver. The format is centralized; `roundThreadId(roundId, userId)` is gone.

### Variants — which to use

| Source | Use for | Example callers |
|---|---|---|
| `round` | Chat in a specific round, per-(round, player) memory | `aiService.stream` from chat-stream router; all 5 Inngest jobs (caddy/hole-summary/pre-round/round-recap/dispute) injecting into the round thread |
| `general` | Chat outside any round, per-user-with-explicit-thread-id | Chat oRPC route (lazily creates UUID) |
| `ephemeral` | One-shot calls with no memory continuity | Voice transcribe, rules-compiler, classifiers, structured-output one-shots |

**Adding a new surface** (post-round chat, future Discord, public coaching) is a one-line addition to the union; TypeScript flags every call site that needs a new switch arm. **Don't pull `roundId` / `discordThreadId` style fields onto every method** — that pattern grows combinatorially. Add a variant.

### `AiStreamOpts` rejects ephemeral

Stream needs continuity by definition, so:

```ts
interface AiStreamOpts extends AiCommonOpts {
  thread: Exclude<ThreadRef, { source: "ephemeral" }>;
  // ...
}
```

Passing `{ source: "ephemeral" }` to `aiService.stream` is a compile-time error. Generate accepts all three.

### `thread_source` is queryable in O(log n)

`ai_usage_events.thread_source` is an enum-typed denormalized column with index `(thread_source, created_at)`. The "spend by surface" query you actually want runs without joining:

```sql
select thread_source, sum(total_cost_micros) as cost_micros
from ai_usage_events
group by 1
order by cost_micros desc;
```

The discriminator flows through `AiContext.threadSource` → metering processor → DB row, so every event is tagged automatically.

### DB enum + drizzle schema

`ai_thread_type` enum: `round | general | ephemeral`. Mirrored in `packages/db/src/models/enums.ts` and `application/types/thread-ref.ts`. **Keep these three in sync** — they all describe the same thing from three angles (DB column, drizzle types, application discriminator).

### Common pattern: `thread` + `memoryWindow`

`memoryWindow.lastMessages: 0` is the "write but don't read history" pattern for proactive Inngest jobs:

```ts
await aiService.generate({
  // ...
  thread: { source: "round", roundId, userId },
  memoryWindow: { lastMessages: 0 },
});
```

The thread itself gets the new message; the prompt doesn't include prior history (saves tokens).

---

## Metering — the output processor pattern

Metering does NOT happen at call sites. It happens in a single Mastra **output processor** (`mastra/metering-processor.ts`) that runs at the end of every agent step. Every `createMeteredAgent` instance has it wired automatically.

The processor:
1. Reads token usage from the step finish payload
2. Looks up the model's pricing
3. Calls `meteringService.finalize(...)` to write `ai_usage_events` + decrement the credit period

This means:
- Per-call-site metering wrappers (the legacy `runMeteredBackgroundGeneration`) are deprecated
- New call sites just call `aiService.{generate, stream}` — metering is automatic
- Any agent that bypasses `createMeteredAgent` will silently not meter (audited by lint rule)

---

## Database ownership

| Table | Owned by | Purpose |
|---|---|---|
| `ai_usage_events` | Us | Per-event ledger entries (one per agent finish). `thread_source` enum column for O(log n) "spend by surface" queries. |
| `ai_usage_ledger` | Us | Append-only credit ledger (reservation, finalize, release) |
| `ai_credit_periods` | Us | Per-user credit grant + usage rollups |
| `ai_models`, `ai_role_assignments`, `ai_providers` | Us | Model registry + role → model resolution |
| `chat_tool_calls` | Us | Per-tool-call audit (args, result, status, errors) |
| `mastra.mastra_messages` | Mastra | Conversation history (Mastra schema) |
| `mastra.mastra_threads` | Mastra | Thread metadata |
| `mastra.mastra_observational_memory` | Mastra | Working-memory blobs |
| `mastra.mastra_resources` | Mastra | Resource references |

**Billing/access reads our tables.** Trace UI (Langfuse) reads OTel exports, which we send via the metering processor. The Mastra schema is internal to Mastra — don't reach into it from application code.

---

## Tool-call persistence — `chat_tool_calls`

Every agent run's `onFinish` hook calls `persistToolCallsFromFinish` (in `application/ai.service.ts`) which walks Mastra's V5 finish payload (steps[].toolCalls + toolResults) and writes one row per tool call to `chat_tool_calls`.

### Status invariants (PIN THESE)

| Mastra V5 shape | `status` |
|---|---|
| `toolResult.isError = true` | `"error"` |
| `toolResult.output.error` truthy | `"error"` |
| Matching tool result, clean output | `"success"` |
| **No matching tool result** | `"pending"` |

The "no matching tool result" branch is the canary. It fires when:
- Mastra rejected the tool input via `validateToolInput`
- Mastra returned `ToolNotFoundError` (the late-bind defect class)
- The stream was cut off before execution

**Never default this branch to `"success"`** — that's how the original missing-tool bug stayed invisible for months. The regression test at `application/persist-tool-calls.test.ts` pins all four cases.

---

## Model resolution

`AiModelResolver` (in `application/ai-model-resolver.service.ts`) resolves a logical role (`"conversational"`, `"caddie"`, etc.) to a concrete model string by reading `ai_role_assignments` from the DB. Cached for 60s per role.

To swap a model in production: `update ai_role_assignments set model_id = (select id from ai_models where model_id = 'X') where role = 'Y'`. No code change.

The resolver is called inside `aiService.{generate,stream}` so every call site uses the current assignment without thinking about it. Default fallbacks are coded as a safety net but emit `console.warn` so missing assignments are visible.

---

## Voice (Mastra OpenAIVoice → Groq Whisper Large v3 Turbo)

Voice transcription goes through `aiService.transcribe(...)` → `agent.voice.listen()` (Mastra `OpenAIVoice` adapter on the orchestrator agent).

**Provider stack (as of 2026-04-25):**
1. Primary — **Groq Whisper Large v3 Turbo** when `GROQ_API_KEY` is set. ~9× cheaper than OpenAI (\$0.04/hr vs \$0.36/hr), same Whisper-large-v3 accuracy, sub-second latency thanks to Groq's hardware (~216× real-time).
2. Fallback — OpenAI Whisper-1 when only `OPENAI_API_KEY` is set. Less accurate, more expensive, but no second API key required.
3. None — voice routes return an error if neither key is set.

We stay Mastra-native: Groq's STT API is OpenAI-compatible (mirrors `/v1/audio/transcriptions` exactly), so Mastra's `OpenAIVoice` adapter pointed at Groq's `baseURL` works unchanged. No separate Mastra Groq adapter needed:

```ts
// golf-assistant.ts (excerpt)
new OpenAIVoice({
  listeningModel: {
    name: "whisper-large-v3-turbo" as never, // type-cast: package only declares OpenAI's own model names
    apiKey: env.GROQ_API_KEY,
    options: { baseURL: "https://api.groq.com/openai/v1" },
  },
})
```

### Domain biasing — golf vocabulary prompt

Every transcription request passes a ~150-token golf-vocabulary prompt (see `infrastructure/mastra/prompts/voice-transcription.prompt.ts`). This is the Wispr-Flow-style "domain protection" — Whisper-family models accept a `prompt` parameter that primes the model to expect listed terms. Without it, "I birdied 7" sometimes transcribes as "I birdy 7"; "Pebble Beach" loses proper-noun casing; club names like "4-iron" get mangled.

The prompt is pinned at <180 estimated tokens (cap is 224) by `voice-transcription.prompt.test.ts` so future additions don't silently overflow.

We also pass `language: "en"` to skip language detection (~50–100ms saved).

### Billing-vs-actual model alignment

The DB `voice` role assignment must match the actual model the code uses. As of 2026-04-25 the role points at `whisper-large-v3-turbo` (Groq); if you swap providers in code, update the role assignment too — otherwise the metering ledger records the wrong model and pricing.

### Known gaps

- `voice.listen()` returns only the transcript string and discards the provider's `usage` block. We estimate audio duration from upload size (`estimateAudioSecondsFromUpload`). Estimates are off by ~10–30% in either direction. Real fix: bypass `OpenAIVoice` and call the underlying API directly so we can read `response.usage.input_audio_seconds`. Tracked as GOLF-399 #14.
- Per-user voice profiling (track each player's pronunciation patterns and append to the prompt) is not implemented. Base vocab covers 95%+ of real golf chat. Worth revisiting only if specific players show consistent transcription errors.
- We don't post-process the transcript through an LLM "fix golf terms" pass. The chat orchestrator already soft-corrects when parsing scores; adding a second LLM call would add ~300ms latency and ~\$0.0001/call without much accuracy gain in practice.

---

## Testing

**Unit tests** (mocked): vitest in the same directory as the file under test. Pattern names follow the project conventions (see `docs/context/patterns/ddd.md` and `docs/context/patterns/testing.md`).

**Integration tests** for Mastra agents: avoid spinning up real LLMs in CI. Test the *contract* — tool registration, schema shape, processor wiring — via `agent.listTools()` and similar introspection methods.

**End-to-end model evals**: the harness at `/tmp/golf-ai-test/test-model-v3.sh` (kept locally, not committed) runs a single-model end-to-end test through the live API. Use this manually after Mastra upgrades or model swaps. Don't run in CI — it costs real $.

### Untested entry points (TODO follow-ups)

The defect surfaced today was hidden because no test exercised `submit_hole_scores` end-to-end. Other AI entry points without end-to-end coverage as of 2026-04-25:

- `correct_hole_score` (same family as submit; covered indirectly by the contract test but no E2E)
- Voice transcribe (`aiService.transcribe`)
- 5 Inngest jobs: `ai-caddy-analysis`, `ai-caddy-fanout`, `ai-hole-summary`, `ai-pre-round-briefing`, `ai-round-recap`
- Post-round chat (no `roundId`)
- Concurrent chats from multiple players in the same round (race on `chat_tool_calls` parsing)

Add coverage when touching these. The pattern is: extract the deterministic logic from the call site, unit-test it; for the LLM-bound path, write a small integration test that asserts contract (tool registration, payload shape) without making real LLM calls.

---

## Common gotchas

- **`global.mastraInstance` singleton.** `getMastra()` (no model) returns a process-wide singleton. `getMastra({ model: "..." })` does NOT cache. Tests that call `getMastra()` directly may hit a stale singleton — go through `aiService.{generate,stream}` or use a model string.
- **Streaming `tool-input-start` ≠ tool registered.** The model may emit a tool call for a name Mastra doesn't have; you'll see input deltas but execution returns `ToolNotFoundError`. Verify registration via `agent.listTools()` if a tool seems unreachable.
- **`scoringMode` defaults to `"creator_only"`.** When creating rounds programmatically (tests, dev-tools simulation), pass `scoringMode: "everyone"` if you want non-creator players to be able to submit scores via chat.
- **Mastra schema-compat round-trip.** When debugging "why does the model see this schema as X", dump it via `z.toJSONSchema(schema)` (raw) and `zodToJsonSchema(schema)` from `@mastra/schema-compat/zod-to-json` (what Mastra ships to the model) — the two should match for our tools. If they don't, we hit a Mastra bug.

---

## When you're stuck

1. Check `chat_tool_calls` for the request's tool calls + their `status`. `status='pending'` means execution never completed — usually the late-bind defect class or a stream cut-off.
2. Check `ai_usage_events` to confirm metering fired.
3. If `status` is wrong everywhere, the parser at `ai.service.ts:persistToolCallsFromFinish` is the place to look — its tests live next to it.
4. If the agent isn't calling a tool you expect, run `agent.listTools()` in a test to see what's actually registered.
5. Last resort: capture the raw `data: {...}` SSE stream from `/api/v1/ai/chat/stream` and grep for `tool-output-error` — that's where Mastra surfaces tool-level failures that don't reach our parser.

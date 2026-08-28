---
name: cursor-agents
description: >
  Hand work off to a Cursor Cloud Agent from a Claude session — launch, poll, follow up,
  cancel — over the Cloud Agents API. Use when a task needs something only Cursor can do
  (a public tunnel for phone or browser testing, Cursor-only marketplace plugins), when you
  want a build running in parallel while you keep working, or when the user says "hand this
  to Cursor" / "run this in a Cursor agent".
---

# Handing work to a Cursor Cloud Agent

Claude cloud sessions cannot open a public tunnel — their egress gateway is HTTP-only on 443
and blocks cloudflared's port 7844. Cursor Cloud Agents can. That asymmetry is the main
reason this exists: a Claude session that needs a device-testable URL should dispatch a
Cursor agent rather than give up.

REST, not MCP: the API costs nothing until called, whereas a connector's tool schema is
billed on every request forever. There is a community MCP server for this; it would also
mean handing a third party the Cursor key. Use curl.

## Credential

`CURSOR_API_KEY` at Infisical `/infrastructure/cursor` (create it in Cursor → Dashboard →
API Keys, or use a service-account key). Never print it.

```bash
CFG=~/.config/bokendell/infisical.json
read -r CID CSEC PID < <(python3 -c "
import json; a=json.load(open('$CFG'))['accounts']['<account>']
print(a['clientId'], a['clientSecret'], a['projectId'])")
TOK=$(infisical login --method=universal-auth --client-id="$CID" --client-secret="$CSEC" --plain --silent)
KEY=$(INFISICAL_TOKEN="$TOK" infisical secrets get CURSOR_API_KEY \
  --projectId="$PID" --path=/infrastructure/cursor --env=development --plain --silent)

cursor_api() {  # cursor_api GET /v1/agents  |  cursor_api POST /v1/agents '<json>'
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "https://api.cursor.com${path}" \
      -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' -d "$body"
  else
    curl -sS -X "$method" "https://api.cursor.com${path}" -H "Authorization: Bearer $KEY"
  fi
}
```

## Launch

```bash
cursor_api POST /v1/agents '{
  "prompt": { "text": "Boot the API and expose it: bash scripts/cloud/tunnel.sh 3000 api. Report the public trycloudflare URL and the HTTP status of /api/v1/health. Leave it running." },
  "repos": [ { "url": "https://github.com/aaronkendell/golf", "startingRef": "main" } ],
  "name": "tunnel for device testing",
  "env": { "type": "cloud", "name": "bagman" },
  "autoCreatePR": false
}'
```

Required: `prompt.text` and `repos[0].url`. Useful optionals: `repos[0].startingRef` (branch
or SHA), `repos[0].prUrl`, `model.id` (e.g. `composer-2`), `name` (≤100 chars),
`env.type` (`cloud` | `pool` | `machine`) with `env.name`, `autoCreatePR`,
`workOnCurrentBranch` (default false), `envVars`, `mcpServers`, `customSubagents`.

The response carries the agent `id`, `status`, and `latestRunId` — keep all three.

## Follow the run

| Do | Call |
|---|---|
| status | `GET /v1/agents/{id}` → `status` is `ACTIVE`, `IDLE`, or `ARCHIVED` |
| run detail | `GET /v1/agents/{id}/runs/{runId}` → `result` text, `durationMs`, branches pushed under `git` |
| live stream | `GET /v1/agents/{id}/runs/{runId}/stream` — SSE: `status`, `assistant`, `thinking`, `tool_call`, `result`, `error`, `done`; resumable with `Last-Event-ID` |
| follow-up | `POST /v1/agents/{id}/runs` with `{"prompt":{"text":"…"}}`, optional `mode` (`agent` \| `plan`) |
| list | `GET /v1/agents?limit=20` (max 100), paginate on `nextCursor` |
| cancel | `POST /v1/agents/{id}/runs/{runId}/cancel` — terminal; start a new run to continue |
| archive | `POST /v1/agents/{id}/archive` — reversible |
| delete | `DELETE /v1/agents/{id}` — **irreversible**; prefer archive |

Poll `GET /v1/agents/{id}` rather than streaming when you only need the outcome; stream when
the user is watching.

## When to hand off, and when not to

**Hand off:** a public tunnel for phone or browser testing · work needing Cursor's own
marketplace plugins · a long build you want running while you keep going · a second opinion
from a different agent stack.

**Do not hand off:** anything touching `private/` or household data · Docker or
Testcontainers work (Cursor agents have no Docker; Claude cloud does) · anything you can
finish in the session you are already in. A handoff costs a cold environment boot.

**Say what you dispatched.** Report the agent id, the `env.name`, and the URL back to the
user — an agent running somewhere they cannot see is worse than no agent.

## Guardrails

- `autoCreatePR: false` unless the user asked for a PR.
- Name every agent (`name`) so the dashboard is legible later.
- Prefer `archive` over `DELETE`; deletion cannot be undone.
- The API is public beta and may change — if a field is rejected, re-read
  `cursor.com/docs/cloud-agent/api/endpoints` rather than guessing.

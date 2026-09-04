#!/usr/bin/env bash
# dispatch.sh <routine> <text...>
# Fires a saved claude.ai routine with the task text. Token: DISPATCH_TOKEN_<ROUTINE> from the environment,
# else Infisical project bokendell /infrastructure/dispatch (env production) via the local machine identity
# (~/.config/bokendell/infisical.json) or INFISICAL_CLIENT_ID_BOKENDELL / INFISICAL_CLIENT_SECRET_BOKENDELL.
set -euo pipefail
ROUTINE="${1:?usage: dispatch.sh <routine> <text>}"; shift; TEXT="${*:?text required}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ID="$(python3 -c 'import json,sys; r=json.load(open(sys.argv[1])); print(r[sys.argv[2]]["id"]) if sys.argv[2] in r else sys.exit("unknown routine "+sys.argv[2]+"; known: "+", ".join(r))' "$DIR/routines.json" "$ROUTINE")"
DEPTH="$(printf '%s' "$TEXT" | grep -oiE 'depth:? *[0-9]+' | grep -oE '[0-9]+' | head -1 || true)"
if [ -n "$DEPTH" ] && [ "$DEPTH" -ge 2 ]; then echo "refused: depth $DEPTH; file a ticket instead of dispatching" >&2; exit 3; fi
KEY="DISPATCH_TOKEN_$(printf '%s' "$ROUTINE" | tr 'a-z-' 'A-Z_')"
TOK="${!KEY:-}"
if [ -z "$TOK" ]; then
  PID=1714e2f7-d947-45f8-8332-56017efbffb0; CFG="$HOME/.config/bokendell/infisical.json"
  if [ -f "$CFG" ]; then
    read -r CID CSEC < <(python3 -c "import json; a=json.load(open('$CFG'))['accounts']['bokendell']; print(a['clientId'], a['clientSecret'])")
  else CID="${INFISICAL_CLIENT_ID_BOKENDELL:-}"; CSEC="${INFISICAL_CLIENT_SECRET_BOKENDELL:-}"; fi
  if [ -n "$CID" ]; then
    IT="$(infisical login --method=universal-auth --client-id="$CID" --client-secret="$CSEC" --plain --silent)"
    TOK="$(INFISICAL_TOKEN="$IT" infisical secrets get "$KEY" --projectId="$PID" --path=/infrastructure/dispatch --env=production --plain --silent 2>/dev/null || true)"
  fi
fi
[ -n "$TOK" ] || { echo "no $KEY: export it or store it in Infisical bokendell /infrastructure/dispatch (production)" >&2; exit 2; }
BODY="$(python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1]}))' "$TEXT")"
curl -sS -f -X POST "https://api.anthropic.com/v1/claude_code/routines/$ID/fire" \
  -H "Authorization: Bearer $TOK" -H "content-type: application/json" -H "anthropic-version: 2023-06-01" -d "$BODY"
echo

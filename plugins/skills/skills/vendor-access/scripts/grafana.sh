#!/usr/bin/env bash
# grafana.sh <app> <gcx args...>
# Runs gcx against <app>'s Grafana stack. Token is fetched from Infisical
# (/infrastructure/grafana) with the machine identity and passed to gcx only
# via env for that one process: nothing is written to disk or printed.
# <app>: golf | hive | portfolio | swarm | keepings
set -euo pipefail
[ $# -ge 2 ] || { echo "usage: grafana.sh <app> <gcx args...>" >&2; exit 2; }
APP=$1; shift
command -v gcx >/dev/null || { echo "gcx not installed (brew install grafana/grafana/gcx, or see vendor-access SKILL.md)" >&2; exit 127; }

CFG=${BOKENDELL_INFISICAL_CONFIG:-$HOME/.config/bokendell/infisical.json}
read -r CID CSEC PID < <(python3 -c "
import json,sys; a=json.load(open('$CFG'))['accounts']['$APP']
print(a['clientId'], a['clientSecret'], a['projectId'])")
TOK=$(infisical login --method=universal-auth --client-id="$CID" --client-secret="$CSEC" --plain --silent)
get() { INFISICAL_TOKEN="$TOK" infisical secrets get "$1" --projectId="$PID" \
  --path=/infrastructure/grafana --env="${GRAFANA_ENV:-development}" --plain --silent; }
URL=$(get GRAFANA_URL); SA=$(get GRAFANA_SA_TOKEN)
unset CID CSEC TOK

# env -i-style scrub of every GRAFANA_*/GCX_* the shell exported, then set ours.
# XDG_CONFIG_HOME points at an empty temp dir so no user config layers in.
EMPTY=$(mktemp -d)/none.yaml; trap 'rm -rf "$(dirname "$EMPTY")"' EXIT
SCRUB=(); for v in $(compgen -e | grep -E '^(GRAFANA|GCX)_'); do SCRUB+=(-u "$v"); done
exec_env=(env ${SCRUB[@]+"${SCRUB[@]}"} XDG_CONFIG_HOME="$(dirname "$EMPTY")" GRAFANA_SERVER="$URL" GRAFANA_TOKEN="$SA" GRAFANA_ORG_ID="${GRAFANA_ORG_ID:-1}")
"${exec_env[@]}" gcx "$@"

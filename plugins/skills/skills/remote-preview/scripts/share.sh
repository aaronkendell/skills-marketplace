#!/usr/bin/env bash
# Start an ephemeral Cloudflare quick tunnel for a local port.
#
# Usage: share.sh <port> [label]
#
# Spawns `cloudflared tunnel --url http://localhost:<port>`, scrapes the
# trycloudflare.com URL from its output, and records it in the state file.
# Prints the URL to stdout on success.

set -euo pipefail

if [[ $# -lt 1 ]]; then
	echo "Usage: share.sh <port> [label]" >&2
	exit 2
fi

PORT="$1"
LABEL="${2:-port-${PORT}}"

if ! [[ "${PORT}" =~ ^[0-9]+$ ]]; then
	echo "Error: port must be numeric, got '${PORT}'" >&2
	exit 2
fi

if ! command -v cloudflared >/dev/null 2>&1; then
	echo "Error: cloudflared not installed. Run scripts/check.sh for install hints." >&2
	exit 1
fi

STATE_DIR="/tmp/claude-remote-preview"
STATE_FILE="${STATE_DIR}/tunnels.json"
LOG_DIR="${STATE_DIR}/logs"
mkdir -p "${STATE_DIR}" "${LOG_DIR}"

if [[ ! -s "${STATE_FILE}" ]]; then
	echo "[]" > "${STATE_FILE}"
fi

TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
SAFE_LABEL="$(echo "${LABEL}" | tr -c '[:alnum:]._-' '_')"
LOG_FILE="${LOG_DIR}/${SAFE_LABEL}-${PORT}.log"

# Start cloudflared in background. Notes:
# - Use 127.0.0.1 explicitly — on macOS `localhost` can resolve to `::1`
#   first, and many local servers (Python http.server with --bind 127.0.0.1,
#   Next, Metro IPv4 sockets) only listen on IPv4. Forcing 127.0.0.1
#   removes all ambiguity.
# - `--config /dev/null` is critical: if the user has a `~/.cloudflared/
#   config.yml` with ingress rules (e.g. from `swarm tunnel init`), cloudflared
#   will silently apply those rules even to a `--url` quick tunnel, and
#   any hostname not matching an ingress rule gets catchall-404'd at
#   cloudflared itself without reaching the origin. Forcing an empty config
#   guarantees the quick tunnel proxies --url unconditionally.
cloudflared tunnel --config /dev/null --no-autoupdate --url "http://127.0.0.1:${PORT}" \
	>"${LOG_FILE}" 2>&1 &
PID=$!

# Watch log for the trycloudflare URL (up to 20s). This only tells us the
# hostname was assigned — edge routing may still be propagating.
URL=""
for _ in $(seq 1 40); do
	if ! kill -0 "${PID}" 2>/dev/null; then
		break
	fi
	if [[ -f "${LOG_FILE}" ]]; then
		URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "${LOG_FILE}" | head -n1 || true)"
		if [[ -n "${URL}" ]]; then
			break
		fi
	fi
	sleep 0.5
done

if [[ -z "${URL}" ]]; then
	echo "Error: cloudflared did not report a URL within 20s. Log: ${LOG_FILE}" >&2
	if kill -0 "${PID}" 2>/dev/null; then
		kill "${PID}" 2>/dev/null || true
	fi
	exit 1
fi

# Wait for a `Registered tunnel connection` line — the edge is only
# reachable once at least one connection is registered, which is distinct
# from the hostname being assigned. Up to 15s.
for _ in $(seq 1 30); do
	if grep -q "Registered tunnel connection" "${LOG_FILE}" 2>/dev/null; then
		break
	fi
	if ! kill -0 "${PID}" 2>/dev/null; then
		echo "Error: cloudflared died before registering a connection. Log: ${LOG_FILE}" >&2
		exit 1
	fi
	sleep 0.5
done

# Verify cloudflared is actually proxying to the origin (not 404'ing due
# to a leaked ingress config — see --config /dev/null comment above).
# Two-phase: probe the URL, then sanity-check cloudflared metrics.
#
# In sandboxed environments (e.g. Claude Code) DNS for *.trycloudflare.com
# may not resolve from the sandbox, so we fall back to --resolve with a
# dig-looked-up IP. If even that fails we swallow the error and just rely
# on the metrics sanity check.
if command -v curl >/dev/null 2>&1; then
	METRICS_PORT="$(grep -oE 'metrics server on 127\.0\.0\.1:[0-9]+' "${LOG_FILE}" 2>/dev/null | grep -oE '[0-9]+$' | head -n1)"
	HOSTNAME="$(echo "${URL}" | sed -E 's|https?://([^/]+).*|\1|')"
	RESOLVED_IP=""
	if command -v dig >/dev/null 2>&1; then
		RESOLVED_IP="$(dig +short "${HOSTNAME}" 2>/dev/null | head -n1)"
	fi

	probe_once() {
		if curl -s -o /dev/null --max-time 3 "${URL}/" >/dev/null 2>&1; then
			return 0
		fi
		if [[ -n "${RESOLVED_IP}" ]]; then
			curl -s -o /dev/null --max-time 3 \
				--resolve "${HOSTNAME}:443:${RESOLVED_IP}" \
				"${URL}/" >/dev/null 2>&1 || true
		fi
		return 0
	}

	for _ in $(seq 1 20); do
		probe_once
		if [[ -n "${METRICS_PORT}" ]]; then
			METRICS="$(curl -s --max-time 2 "http://127.0.0.1:${METRICS_PORT}/metrics" 2>/dev/null || true)"
			TOTAL="$(echo "${METRICS}" | grep -E '^cloudflared_tunnel_total_requests ' | awk '{print $2}')"
			if [[ -n "${TOTAL}" && "${TOTAL}" != "0" ]]; then
				# Requests are reaching cloudflared. Sanity-check for the
				# ingress-config-leak signature: all responses are 404 and
				# zero origin errors means cloudflared is short-circuiting
				# without ever trying to reach ${PORT}.
				ERRORS="$(echo "${METRICS}" | grep -E '^cloudflared_tunnel_request_errors ' | awk '{print $2}')"
				NON_404="$(echo "${METRICS}" | grep -E '^cloudflared_tunnel_response_by_code\{status_code="[^4]' | awk '{sum += $2} END {print sum+0}')"
				CODE_404="$(echo "${METRICS}" | grep -E '^cloudflared_tunnel_response_by_code\{status_code="404"\}' | awk '{print $2}')"
				if [[ "${TOTAL}" == "${CODE_404:-0}" && "${ERRORS:-0}" == "0" && "${NON_404:-0}" == "0" ]]; then
					echo "Warning: cloudflared 404'd every request without reaching the origin." >&2
					echo "  This almost always means ~/.cloudflared/config.yml has ingress rules" >&2
					echo "  that are leaking into the quick tunnel. share.sh passes" >&2
					echo "  --config /dev/null to avoid this; if you see this, you may have" >&2
					echo "  TUNNEL_* env vars set or an alternative config path in play." >&2
				fi
				break
			fi
		fi
		sleep 0.5
	done
fi

# Append to state file atomically (no jq dependency — use python).
python3 - <<PY
import json, os
state_file = "${STATE_FILE}"
entry = {
    "pid": ${PID},
    "port": ${PORT},
    "label": "${LABEL}",
    "url": "${URL}",
    "log": "${LOG_FILE}",
    "startedAt": "${TIMESTAMP}",
}
try:
    with open(state_file) as f:
        data = json.load(f)
    if not isinstance(data, list):
        data = []
except (FileNotFoundError, json.JSONDecodeError):
    data = []
data.append(entry)
with open(state_file, "w") as f:
    json.dump(data, f, indent=2)
PY

cat <<EOF
Tunnel ready.
  label: ${LABEL}
  port:  ${PORT}
  url:   ${URL}
  pid:   ${PID}
  log:   ${LOG_FILE}

Stop with: bash scripts/stop.sh ${PORT}
      or:  bash scripts/stop.sh "${LABEL}"
      or:  bash scripts/stop.sh --all
EOF

echo "${URL}"

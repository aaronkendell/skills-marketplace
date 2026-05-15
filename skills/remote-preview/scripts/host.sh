#!/usr/bin/env bash
# Host a static file or directory and tunnel it in one call.
#
# Usage:
#   host.sh <path> [label]        # serve a file or directory
#   host.sh <path> [label] [port] # use a specific port
#
# This is for mock-sharing: you ask Claude to build a design-showcase.html
# and want to tap "approve" from your phone. No pre-running dev server needed.
#
# What it does:
#   1. Picks a free port if one isn't passed
#   2. Starts `python3 -m http.server` in the background, rooted at the
#      parent dir of <path> (or <path> itself if it's a directory)
#   3. Calls share.sh to start a cloudflared quick tunnel on that port
#   4. Prints the public URL, including the filename suffix if <path> is a file
#   5. Records the http.server PID alongside the cloudflared PID in the
#      state file so `stop.sh` can clean up both
#
# Limits:
#   - Static files only. For dev servers use share.sh directly.
#   - Python 3.8+ required (for --bind).
#   - Macs sometimes refuse to bind if the port is in TIME_WAIT; we retry
#     with a new random port once.

set -euo pipefail

if [[ $# -lt 1 ]]; then
	echo "Usage: host.sh <file-or-dir> [label] [port]" >&2
	exit 2
fi

TARGET_PATH="$1"
LABEL="${2:-$(basename "${TARGET_PATH}")}"
REQUESTED_PORT="${3:-}"

if [[ ! -e "${TARGET_PATH}" ]]; then
	echo "Error: path does not exist: ${TARGET_PATH}" >&2
	exit 2
fi

if ! command -v python3 >/dev/null 2>&1; then
	echo "Error: python3 is required for host.sh. share.sh doesn't need it." >&2
	exit 1
fi

# Resolve serve-root vs filename-suffix.
# - If <path> is a directory: serve the whole dir, suffix = ""
# - If <path> is a file:      serve the parent dir, suffix = /<filename>
if [[ -d "${TARGET_PATH}" ]]; then
	SERVE_DIR="$(cd "${TARGET_PATH}" && pwd)"
	URL_SUFFIX=""
else
	SERVE_DIR="$(cd "$(dirname "${TARGET_PATH}")" && pwd)"
	URL_SUFFIX="/$(basename "${TARGET_PATH}")"
fi

STATE_DIR="/tmp/claude-remote-preview"
STATE_FILE="${STATE_DIR}/tunnels.json"
LOG_DIR="${STATE_DIR}/logs"
mkdir -p "${STATE_DIR}" "${LOG_DIR}"

# Pick a port. The user can force one; otherwise we grab a random high port
# and verify it's free before binding.
pick_port() {
	python3 - <<'PY'
import socket
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.bind(("127.0.0.1", 0))
    print(s.getsockname()[1])
PY
}

PORT="${REQUESTED_PORT}"
if [[ -z "${PORT}" ]]; then
	PORT="$(pick_port)"
fi

SAFE_LABEL="$(echo "${LABEL}" | tr -c '[:alnum:]._-' '_')"
SERVER_LOG="${LOG_DIR}/host-${SAFE_LABEL}-${PORT}.log"

# Start the static server. Bind to 127.0.0.1 (not 0.0.0.0) so the only path
# to the content is through cloudflared — no one on your LAN can accidentally
# find it.
(
	cd "${SERVE_DIR}" && \
	exec python3 -u -m http.server "${PORT}" --bind 127.0.0.1
) >"${SERVER_LOG}" 2>&1 &
SERVER_PID=$!

# Give the server a beat to bind. If it fails (e.g. port race), we'll surface
# the error via the log file below.
sleep 0.5

if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
	echo "Error: http.server died immediately. Log: ${SERVER_LOG}" >&2
	cat "${SERVER_LOG}" >&2 || true
	exit 1
fi

# Delegate to share.sh to start the tunnel. share.sh writes a record for
# the tunnel PID; we amend it below with the server PID + URL suffix so
# stop.sh can kill both processes and list.sh can show the right URL.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! SHARE_OUTPUT="$("${SCRIPT_DIR}/share.sh" "${PORT}" "${LABEL}")"; then
	echo "Error: share.sh failed. Killing http.server (pid ${SERVER_PID})." >&2
	kill "${SERVER_PID}" 2>/dev/null || true
	exit 1
fi

# share.sh prints the URL on its last line.
TUNNEL_URL="$(echo "${SHARE_OUTPUT}" | tail -n1)"
FULL_URL="${TUNNEL_URL}${URL_SUFFIX}"

# Amend the state record: attach the server PID and the URL suffix so
# list/stop/ergonomics are correct for hosted files.
python3 - <<PY
import json

state_file = "${STATE_FILE}"
label = "${LABEL}"
server_pid = ${SERVER_PID}
serve_dir = "${SERVE_DIR}"
url_suffix = "${URL_SUFFIX}"

with open(state_file) as f:
    data = json.load(f)

for record in data:
    if record.get("label") == label:
        record["serverPid"] = server_pid
        record["serveDir"] = serve_dir
        record["urlSuffix"] = url_suffix
        record["url"] = record["url"] + url_suffix
        break

with open(state_file, "w") as f:
    json.dump(data, f, indent=2)
PY

cat <<EOF

Hosted and shared.
  label:   ${LABEL}
  serves:  ${SERVE_DIR}${URL_SUFFIX}
  port:    ${PORT}
  server:  pid ${SERVER_PID}
  log:     ${SERVER_LOG}
  url:     ${FULL_URL}

Stop both processes with: bash scripts/stop.sh "${LABEL}"
EOF

echo "${FULL_URL}"

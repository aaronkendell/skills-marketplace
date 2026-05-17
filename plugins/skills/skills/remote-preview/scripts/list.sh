#!/usr/bin/env bash
# List all tunnels recorded by share.sh with live PID status.
set -euo pipefail

STATE_FILE="/tmp/claude-remote-preview/tunnels.json"

if [[ ! -f "${STATE_FILE}" ]]; then
	echo "No tunnels recorded. Start one with scripts/share.sh <port>."
	exit 0
fi

python3 - <<'PY'
import json, os, sys
state_file = "/tmp/claude-remote-preview/tunnels.json"
try:
    with open(state_file) as f:
        data = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    data = []

if not data:
    print("No tunnels recorded.")
    sys.exit(0)

def alive(pid):
    try:
        os.kill(int(pid), 0)
        return True
    except (ProcessLookupError, PermissionError, ValueError):
        return False

rows = [("PID", "PORT", "STATUS", "LABEL", "URL", "STARTED")]
for e in data:
    rows.append((
        str(e.get("pid", "")),
        str(e.get("port", "")),
        "alive" if alive(e.get("pid", -1)) else "dead",
        str(e.get("label", ""))[:30],
        str(e.get("url", "")),
        str(e.get("startedAt", "")),
    ))

widths = [max(len(r[i]) for r in rows) for i in range(len(rows[0]))]
for i, row in enumerate(rows):
    line = "  ".join(cell.ljust(widths[idx]) for idx, cell in enumerate(row))
    print(line)
    if i == 0:
        print("  ".join("-" * w for w in widths))
PY

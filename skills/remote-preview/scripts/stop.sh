#!/usr/bin/env bash
# Stop one or all tunnels recorded by share.sh.
#
# Usage:
#   stop.sh <port>      Stop tunnel bound to that port
#   stop.sh <label>     Stop tunnel with that label
#   stop.sh --all       Stop every recorded tunnel

set -euo pipefail

if [[ $# -lt 1 ]]; then
	echo "Usage: stop.sh <port|label|--all>" >&2
	exit 2
fi

TARGET="$1"
STATE_FILE="/tmp/claude-remote-preview/tunnels.json"

if [[ ! -f "${STATE_FILE}" ]]; then
	echo "No tunnels recorded."
	exit 0
fi

python3 - "$TARGET" <<'PY'
import json, os, signal, sys

target = sys.argv[1]
state_file = "/tmp/claude-remote-preview/tunnels.json"

try:
    with open(state_file) as f:
        data = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    data = []

if not data:
    print("No tunnels recorded.")
    sys.exit(0)

def matches(entry, target):
    if target == "--all":
        return True
    if str(entry.get("port")) == target:
        return True
    if str(entry.get("label")) == target:
        return True
    return False

def try_kill(pid, what):
    if pid is None or pid < 0:
        return
    try:
        os.kill(int(pid), signal.SIGTERM)
        print(f"  killed {what} pid={pid}")
    except ProcessLookupError:
        pass
    except PermissionError as exc:
        print(f"  cannot kill {what} pid={pid}: {exc}")

kept = []
killed = 0
for e in data:
    if matches(e, target):
        pid = int(e.get("pid", -1))
        server_pid = e.get("serverPid")
        print(f"stopping label={e.get('label')} port={e.get('port')} url={e.get('url')}")
        try_kill(pid, "cloudflared")
        if server_pid is not None:
            try_kill(server_pid, "http.server")
        killed += 1
    else:
        kept.append(e)

with open(state_file, "w") as f:
    json.dump(kept, f, indent=2)

if killed == 0 and target != "--all":
    print(f"No tunnel matched '{target}'.")
    sys.exit(1)
PY

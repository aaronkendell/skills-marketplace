#!/usr/bin/env bash
# Verify cloudflared is installed and available on PATH.
# Exits 0 if ready, 1 otherwise.
set -euo pipefail

if ! command -v cloudflared >/dev/null 2>&1; then
	cat >&2 <<'EOF'
cloudflared is not installed.

Install it with one of:
  macOS:    brew install cloudflared
  Linux:    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  Windows:  winget install --id Cloudflare.cloudflared

Then rerun this skill.
EOF
	exit 1
fi

version="$(cloudflared --version 2>&1 | head -n1)"
echo "cloudflared available: ${version}"

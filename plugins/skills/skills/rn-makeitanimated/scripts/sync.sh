#!/usr/bin/env bash
# Clone-if-missing / pull the user's own licensed checkout of rn-makeitanimated
# (github.com/make-it-animated/rn-makeitanimated, branch "public") to a fixed
# local path, so its patterns are always current when this skill is loaded.
#
# This is a PRIVATE, PAID repo. Only run this if you already have your own
# licensed access — this script does not grant access, just keeps an
# existing licensed clone up to date. Never push, fork-publish, or otherwise
# redistribute this repo's contents.
#
# Usage: sync.sh [path]   (defaults to ~/repos/bokendell/rn-makeitanimated)

set -euo pipefail

REPO_URL="git@github.com:make-it-animated/rn-makeitanimated.git"
TARGET="${1:-$HOME/repos/bokendell/rn-makeitanimated}"

if [[ -d "$TARGET/.git" ]]; then
	echo "Pulling latest public branch into $TARGET"
	git -C "$TARGET" fetch origin public
	git -C "$TARGET" checkout public
	git -C "$TARGET" pull origin public
else
	echo "No existing checkout at $TARGET — cloning (requires your own licensed access)"
	git clone --branch public "$REPO_URL" "$TARGET"
fi

echo "Done. HEAD is now: $(git -C "$TARGET" rev-parse --short HEAD)"

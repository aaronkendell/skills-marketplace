#!/usr/bin/env bash
# Re-fetch every page in pages.txt from effect.website/docs/v4 into docs/<path>.md.
# The site serves each page's source markdown at <page>.md; if that ever stops working,
# the page's HTML is fetched and converted by convert.py instead (needs uv).
# Usage: ./refresh.sh                 (all pages)
#        ./refresh.sh caching/cache   (one or more pages)
set -euo pipefail
cd "$(dirname "$0")"
BASE="https://effect.website/docs/v4"
if [ $# -gt 0 ]; then pages=("$@"); else pages=(); while IFS= read -r l; do [ -n "$l" ] && pages+=("$l"); done < pages.txt; fi
fail=0
for p in "${pages[@]}"; do
  out="docs/$p.md"; mkdir -p "$(dirname "$out")"
  hdr="<!-- source: $BASE/$p/ · fetched $(date +%F) -->"
  ctype=$(curl -fsSL -o "$out.src" -w '%{content_type}' "$BASE/$p.md" 2>/dev/null || true)
  if [[ "$ctype" == text/markdown* ]]; then
    { echo "$hdr"; echo; cat "$out.src"; } > "$out"; echo "ok   $p"
  elif curl -fsSL "$BASE/$p/" -o "$out.src" &&
       body=$(uv run -q --with beautifulsoup4 --with markdownify python3 convert.py < "$out.src"); then
    { echo "$hdr"; echo; printf '%s\n' "$body"; } > "$out"; echo "ok   $p (html)"
  else echo "FAIL $p"; fail=1; fi
  rm -f "$out.src"
done
exit $fail

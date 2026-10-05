#!/bin/sh
# CLI-sandbox spike (2026-10-05), part 2: the agent-side work of the check-domain-availability
# process against Porkbun's documented keyless public surface (the same endpoints the committed
# domain-registrars probes already record — pricing API, credential-free mock server, llms.txt).
# Read-only, credential-free, documented-public endpoints only.
set -u
SPIKE_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$SPIKE_DIR/transcript-porkbun-keyless.txt"
: > "$OUT"

cap() {
  echo "\$ $1" >> "$OUT"
  shift
  "$@" >> "$OUT" 2>&1
  echo "" >> "$OUT"
  echo "(exit $?)" >> "$OUT"
  echo >> "$OUT"
}

cap "curl -s -X POST https://api.porkbun.com/api/json/v3/pricing/get | head -c 400" \
  sh -c "curl -s --max-time 20 -X POST https://api.porkbun.com/api/json/v3/pricing/get -H 'Content-Type: application/json' -d '{}' | head -c 400"

cap "curl -s https://api.porkbun.com/api/json/v3/mock/domain/listAll | head -c 400" \
  sh -c "curl -s --max-time 20 https://api.porkbun.com/api/json/v3/mock/domain/listAll | head -c 400"

cap "curl -s -X POST https://api.porkbun.com/api/json/v3/mock/domain/checkDomain/example.com | head -c 400" \
  sh -c "curl -s --max-time 20 -X POST https://api.porkbun.com/api/json/v3/mock/domain/checkDomain/example.com -H 'Content-Type: application/json' -d '{}' | head -c 400"

cap "curl -s https://porkbun.com/llms.txt | head -5" \
  sh -c "curl -sL --max-time 20 https://porkbun.com/llms.txt | head -5"

cap "npm view @porkbunllc/mcp-server version" \
  npm view @porkbunllc/mcp-server version

echo "transcript written to $OUT"

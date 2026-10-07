#!/bin/sh
# Self-eval probe sweep (2026-10-07, founder ask: "self eval using the probe stuff we built,
# on the UM CLI/MCP"). Runs EVERY `ultrametric@0.4.1` command keylessly, exactly as a visitor
# with no account could, plus the hosted MCP's keyless surface, and captures a verbatim
# transcript with exit codes — the same capture pattern as docs/cli-sandbox-spike/.
#
# Isolation: every CLI call gets --data-dir pointed at a scratch directory, so no local
# login, settings, or logs leak in (the CLI keeps auth.json/settings.json/logs under the
# data dir — verified by `doctor` in the transcript). Read-only toward the hosted API
# throughout, with two deliberate exceptions, both keyless by definition:
#   - `auth login --json` creates a short-lived pending login (device-code style) and exits;
#     nothing is approved, and the recorded user code expires the same day.
#   - `auth complete <login-id>` checks that pending login once (expected: not approved).
# `init` runs with --dry-run (no project files written); companies/assessments/actions/config
# writes touch only the scratch data dir. No credentials exist anywhere in this session.
set -u
PROBE_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRATCH="$(mktemp -d /tmp/um-self-eval.XXXXXX)"
DATA_DIR="$SCRATCH/data"
PROJECT_DIR="$SCRATCH/project"
mkdir -p "$DATA_DIR" "$PROJECT_DIR"
OUT="$PROBE_DIR/transcript-self-eval-keyless.txt"
: > "$OUT"

run() {
  echo "\$ $*" >> "$OUT"
  "$@" >> "$OUT" 2>&1
  echo "(exit $?)" >> "$OUT"
  echo >> "$OUT"
}

UM="npx -y ultrametric@0.4.1 --data-dir $DATA_DIR"

# -- diagnostics / meta (expected keyless) ------------------------------------------------
run $UM --version
run $UM --help
run $UM doctor
run $UM config show
run $UM config set logging true
run $UM logs show

# -- auth ---------------------------------------------------------------------------------
run $UM auth status
run $UM auth login --json
# Check the login this sweep just opened, once (expected: still pending — nobody approved it).
LOGIN_ID="$(sed -n 's/.*"loginId": "\([^"]*\)".*/\1/p' "$OUT" | tail -1)"
run $UM auth complete "${LOGIN_ID:-missing-login-id}"
run $UM auth logout

# -- init (dry run: no project writes) ----------------------------------------------------
run $UM init --path "$PROJECT_DIR" --dry-run

# -- hosted schemas (expected keyless) ----------------------------------------------------
run $UM context schema open
run $UM context schema save
run $UM context schema get

# -- hosted process + context surface (expected auth-gated) -------------------------------
run $UM process list
run $UM process get check-domain-availability
run $UM process open check-domain-availability
run $UM context get --json
run $UM context save

# -- local records (expected keyless, offline) --------------------------------------------
run $UM companies schema
run $UM companies list
run $UM companies show example-company
printf '{}' > "$SCRATCH/empty-profile.json"
run $UM companies validate --file "$SCRATCH/empty-profile.json"
run $UM companies save --file "$SCRATCH/empty-profile.json"
run $UM assessments schema
run $UM assessments list
run $UM assessments show example-assessment
run $UM assessments save --file "$SCRATCH/empty-profile.json"
run $UM actions set example-assessment example-action --status chosen
run $UM understand --json --path "$PROJECT_DIR"
run $UM assess --json --path "$PROJECT_DIR" --project self-eval-probe

# -- arena reads (ProductArena data; broken in the shipped CLI until the worker fix deploys)
run $UM arena categories --json
run $UM arena rankings domain-registrars --json
run $UM arena stories domain-registrars --json
run $UM arena verdict domain-registrars porkbun api_quality --json

# -- hosted MCP, keyless (expected: structured AUTH_REQUIRED refusals) ---------------------
run curl -sS -X POST https://api.ultrametric.ai/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"productarena-probe","version":"1.0"}}}'
run curl -sS -X POST https://api.ultrametric.ai/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
run curl -sS -o /dev/null -w 'HTTP %{http_code}\n' https://api.ultrametric.ai/mcp
# The auth wall's own disclosure: response headers (WWW-Authenticate) and the RFC 9728
# protected-resource metadata it advertises — the same enrichment our Try-it probe applies to
# vendor MCP walls (fetchAuthWallMetadata in infra/cloudflare-proxy/worker.js).
run curl -sS -o /dev/null -D - -X POST https://api.ultrametric.ai/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"productarena-probe","version":"1.0"}}}'
run curl -sS https://api.ultrametric.ai/.well-known/oauth-protected-resource

echo "transcript written to $OUT"

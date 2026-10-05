#!/bin/sh
# CLI-sandbox spike (2026-10-05): drive the shipped `ultrametric` CLI keylessly, exactly as a
# site visitor with no account could, and capture a verbatim session transcript. HOME is pointed
# at a scratch dir so no local login/config leaks in — every command below runs credential-free.
# Read-only throughout: --help, doctor, auth status, schema prints, arena reads, one process
# retrieval attempt (expected to require login — that outcome is part of the finding).
set -u
SPIKE_DIR="$(cd "$(dirname "$0")" && pwd)"
export HOME="$SPIKE_DIR/home"
OUT="$SPIKE_DIR/transcript-ultrametric-keyless.txt"
: > "$OUT"

run() {
  echo "\$ $*" >> "$OUT"
  "$@" >> "$OUT" 2>&1
  echo "(exit $?)" >> "$OUT"
  echo >> "$OUT"
}

UM="npx -y ultrametric@0.4.1"
run $UM --version
run $UM --help
run $UM doctor
run $UM auth status
run $UM context schema open
run $UM arena categories --json
run $UM arena rankings domain-registrars --json
run $UM process list
run $UM process get check-domain-availability

echo "transcript written to $OUT"

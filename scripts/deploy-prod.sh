#!/usr/bin/env bash
# Production deploy — batched cadence to keep Vercel build-minute costs down.
#
# Cost rationale (founder, 2026-09-18): dozens of per-merge deploys × minutes of Vercel build
# CPU each was the bill. Prebuilt upload was tested and is NOT viable here (this app builds 41
# function bundles / ~12GB of output; the prebuilt upload manifest exceeds Vercel's 10MB request
# limit, and shipping GBs per deploy would cost more than remote builds). The effective lever is
# CADENCE: push to git on every merge (free), deploy AT MOST once per merge-wave / founder-
# visible batch — target ≤3 production deploys/day. This script enforces a soft floor: it
# refuses to deploy if the last deploy was <2h ago unless FORCE=1.
#
# Usage: ./scripts/deploy-prod.sh   (from anywhere; operates on /tmp/pa-deploy @ origin/main)
set -euo pipefail

REPO=/Users/judegomila/Documents/GitHub/productarena
DEPLOY=/tmp/pa-deploy

# Always a FRESH clone: macOS purges /tmp entries across days, and a half-purged clone once
# passed the old [ -d .git ] check and deployed a 19MB remnant of the site (2026-10-04).
rm -rf "$DEPLOY"
git clone --depth 1 https://github.com/ultrametricai/ultrametric.git "$DEPLOY"
cp -R "$REPO/.vercel" "$DEPLOY/.vercel"
cd "$DEPLOY"
# Sentinel: a real checkout has the workspace pnpmfile; abort rather than deploy a partial tree.
[ -f scripts/pnpmfile.cjs ] && [ -f processes/corpus.json ] || { echo "ABORT: clone incomplete"; exit 1; }
HEAD_LINE=$(git log --oneline -1)
echo "deploying $HEAD_LINE"

# Stamp lives OUTSIDE the clone dir (the clone is nuked every run).
STAMP=/tmp/pa-last-deploy-epoch
NOW=$(date +%s)
if [ "${FORCE:-0}" != "1" ] && [ -f "$STAMP" ]; then
  LAST=$(cat "$STAMP"); AGE=$(( NOW - LAST ))
  if [ "$AGE" -lt 7200 ]; then
    echo "SKIP: last deploy ${AGE}s ago (<2h). Batch more merges or FORCE=1." ; exit 0
  fi
fi
# No --turbo: the flag never produced a Turbo build (silently downgraded to 4-core, then
# started refusing outright with "Not authorized" on 2026-10-05) — enabling bigger build
# machines is a team-dashboard action, and the project-level setting applies server-side
# without any flag. Deploys FIT the Standard 32 GB machine since the /vs→battle dedup.
# npx pins a current CLI (the global install once sent a malformed turbo override).
# Pinned to the 62.x major: vercel@63.1.0 stopped honoring the stored CLI credentials
# (two "Not authorized" deploy-creation failures on 2026-10-08 with an API-verified token;
# 62.x deploys fine). Bump deliberately after verifying auth compat.
npx -y vercel@62 deploy --prod --archive=tgz --yes
echo "$NOW" > "$STAMP"

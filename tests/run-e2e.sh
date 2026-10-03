#!/usr/bin/env bash
# Runs the browser walk-through against the emulators. Called by `npm run test:e2e`, which starts the
# Auth + Firestore emulators around it (firebase emulators:exec) and stops them afterwards.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"

VITE_USE_EMULATORS=true "$here/node_modules/.bin/vite" "$here" --port 5173 --strictPort >"${TMPDIR:-/tmp}/e2e-vite.log" 2>&1 &
vite_pid=$!
trap 'kill "$vite_pid" 2>/dev/null || true' EXIT

curl -s -o /dev/null --retry 30 --retry-connrefused --retry-delay 1 http://localhost:5173/
node "$here/tests/e2e.mjs" "${E2E_SHOTS:-$here/e2e-shots}"

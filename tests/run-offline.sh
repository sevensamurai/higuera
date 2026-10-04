#!/usr/bin/env bash
# Runs the offline checks against a production build (the service worker only exists there) wired to the
# emulators. Called by `npm run test:offline`, which starts Auth + Firestore around it.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
dist="${TMPDIR:-/tmp}/offline-dist"

VITE_USE_EMULATORS=true "$here/node_modules/.bin/vite" build "$here" --outDir "$dist" --emptyOutDir --logLevel error
"$here/node_modules/.bin/vite" preview "$here" --outDir "$dist" --port 5175 --strictPort >"${TMPDIR:-/tmp}/offline-preview.log" 2>&1 &
preview_pid=$!
trap 'kill "$preview_pid" 2>/dev/null || true' EXIT

curl -s -o /dev/null --retry 30 --retry-connrefused --retry-delay 1 http://localhost:5175/
node "$here/tests/offline.mjs"

#!/usr/bin/env bash
# Runs the Auth + Firestore emulators and the dev server so other devices on your local network can
# browse the app (phone, a second laptop). Ctrl+C stops both.
#
#   npm run dev:lan
#
# Needs Java 21+ on PATH for the emulators. The emulators accept any fake sign-in and have no real
# security, so only use this on a network you trust. Google sign-in on a real project is not
# available this way (Firebase only allows sign-in from authorized domains, never a bare IP).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
cd "$here"

ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
ip="${ip:-localhost}"

for port in 5173 8080 9099; do
  if (echo >"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    echo "Port $port is already in use. Stop whatever is using it first (another dev:lan or emulators?)." >&2
    exit 1
  fi
done

cleanup() {
  trap - EXIT INT TERM
  [ -n "${vite_pid:-}" ] && kill "$vite_pid" 2>/dev/null || true
  [ -n "${emu_pid:-}" ] && kill "$emu_pid" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting emulators…"
./node_modules/.bin/firebase --config firebase.lan.json emulators:start \
  --only auth,firestore --project demo-tutor-booking >"${TMPDIR:-/tmp}/dev-lan-emulators.log" 2>&1 &
emu_pid=$!

# Wait until both emulators answer (and fail early if the emulator process dies, e.g. no Java).
for _ in $(seq 1 90); do
  if ! kill -0 "$emu_pid" 2>/dev/null; then
    echo "The emulators exited. Last lines of ${TMPDIR:-/tmp}/dev-lan-emulators.log:" >&2
    tail -n 15 "${TMPDIR:-/tmp}/dev-lan-emulators.log" >&2
    exit 1
  fi
  if curl -s -o /dev/null http://127.0.0.1:8080/ && curl -s -o /dev/null http://127.0.0.1:9099/; then break; fi
  sleep 1
done

cat <<MSG

  Ready. Open on any device on this network:

      http://$ip:5173/

  Emulators: Auth :9099, Firestore :8080. Sign in with the fake Google account form.
  Press Ctrl+C to stop everything.

MSG

VITE_USE_EMULATORS=true ./node_modules/.bin/vite --host --port 5173 --strictPort &
vite_pid=$!
wait "$vite_pid"

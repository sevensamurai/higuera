#!/usr/bin/env bash
# Serves the app to other devices on your local network (phone, a second laptop). Ctrl+C stops it.
#
#   npm run dev:lan        emulators + dev server: fake local data and fake sign-in (nothing real is touched)
#   npm run dev:lan:live   dev server only, connected to the real Firebase project from .env.local
#                          (real data; sign-in with real Google through a <ip>.sslip.io name, see README)
#
# Needs Java 21+ on PATH for the emulators (emulator mode only). The emulators accept any fake sign-in
# and have no real security, so only use emulator mode on a network you trust.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
cd "$here"

ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
ip="${ip:-localhost}"
mode="${1:-emulators}"
case "$mode" in emulators | live) ;; *) echo "usage: $0 [emulators|live]" >&2; exit 2 ;; esac

ports=(5173)
[ "$mode" = emulators ] && ports+=(8080 9099)
for port in "${ports[@]}"; do
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

if [ "$mode" = emulators ]; then
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
  url="http://$ip:5173/"
  extra="  Emulators: Auth :9099, Firestore :8080. Sign in with the fake Google account form."
  export VITE_USE_EMULATORS=true
else
  if ! grep -q '^VITE_FIREBASE_PROJECT_ID=.\+' .env.local 2>/dev/null; then
    echo "No Firebase config: fill in .env.local first (see .env.example)." >&2
    exit 1
  fi
  # Firebase only allows sign-in from named domains, not IPs; sslip.io maps <a-b-c-d>.sslip.io to a.b.c.d.
  host="${ip//./-}.sslip.io"
  url="http://$host:5173/"
  extra="  LIVE data: this is the real Firebase project. Sign-in needs $host in Firebase
  Authentication → Settings → Authorized domains (README: Browsing from another device)."
  export VITE_USE_EMULATORS=false
fi

cat <<MSG

  Ready. Open on any device on this network:

      $url

$extra
  Press Ctrl+C to stop everything.

MSG

./node_modules/.bin/vite --host --port 5173 --strictPort &
vite_pid=$!
wait "$vite_pid"

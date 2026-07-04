#!/usr/bin/env bash
# TriARge full-setup launcher (double-clickable in Finder).
#
# Starts the complete simulation environment:
#   Terminal 1: Incident Command hub (Einsatzleitung)
#   Browser:    live dashboard
#   Terminal 2: Einsatztrupp "Trupp-1" (AR glasses simulation)
#   Terminal 3: Einsatztrupp "Trupp-2" (AR glasses simulation)
#
# Missing virtual environments are created on first run (requires uv).
set -euo pipefail
cd "$(dirname "$0")"
DIR="$(pwd)"
PORT="${TRIARGE_PORT:-8087}"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }

# ---------------------------------------------------------------- venvs
ensure_venv() {
  local venv="$1"; shift
  if [[ ! -x "$venv/bin/python" ]]; then
    bold "Erstelle $venv ..."
    if command -v uv >/dev/null; then
      uv venv --python 3.12 "$venv"
      uv pip install --python "$venv" "$@"
    else
      python3 -m venv "$venv"
      "$venv/bin/pip" install "$@"
    fi
  fi
}
ensure_venv .venv        -r requirements/hub.txt -r requirements/hub-ai.txt
ensure_venv .venv-client -r requirements/client.txt

in_new_terminal() {
  /usr/bin/osascript >/dev/null <<EOF
tell application "Terminal"
  activate
  do script "cd \"$DIR\" && $1"
end tell
EOF
}

# ------------------------------------------------------------------ hub
if curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
  bold "Hub läuft bereits auf Port $PORT — wird weiterverwendet."
else
  bold "Starte Einsatzleitungs-Hub ..."
  in_new_terminal "./.venv/bin/python -m hub.main"
  for _ in $(seq 1 60); do
    curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break
    sleep 0.5
  done
  if ! curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    bold "FEHLER: Hub ist nicht erreichbar — siehe Hub-Terminal."
    exit 1
  fi
fi

# Register the two squads so the dashboard shows them immediately
# (clients would auto-register via heartbeat anyway).
curl -sf -X POST "http://127.0.0.1:$PORT/api/teams?name=Trupp-1" >/dev/null || true
curl -sf -X POST "http://127.0.0.1:$PORT/api/teams?name=Trupp-2" >/dev/null || true

bold "Öffne Dashboard ..."
open "http://localhost:$PORT"

# -------------------------------------------------------------- clients
bold "Starte Einsatztrupp 1 und 2 ..."
in_new_terminal "./.venv-client/bin/python -m client.main --medic-id Trupp-1"
sleep 2   # stagger camera initialization
in_new_terminal "./.venv-client/bin/python -m client.main --medic-id Trupp-2"

bold "Fertig. Hub + Dashboard + 2 Trupps laufen."
echo "Dieses Fenster kann geschlossen werden — beendet wird in den jeweiligen Terminals (Ctrl-C bzw. 'q')."

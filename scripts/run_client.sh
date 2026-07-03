#!/usr/bin/env bash
# Start the TriARge paramedic client (AR glasses simulation).
# All arguments are forwarded, e.g.:  scripts/run_client.sh --hub http://192.168.0.10:8087 --medic-id RTW-2
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -d .venv-client ]]; then
  echo "Creating client venv and installing dependencies ..."
  python3 -m venv .venv-client
  ./.venv-client/bin/pip install --quiet -r requirements/client.txt
fi

exec ./.venv-client/bin/python -m client.main "$@"

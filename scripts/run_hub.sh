#!/usr/bin/env bash
# Start the TriARge Incident Command hub.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -d .venv ]]; then
  echo "Creating venv and installing hub dependencies ..."
  python3 -m venv .venv
  ./.venv/bin/pip install --quiet -r requirements/hub.txt
fi

exec ./.venv/bin/python -m hub.main

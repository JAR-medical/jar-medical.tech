#!/bin/sh
# Verify the tools this job needs exist, and fail loudly naming the fix.
set -eu

job="${1:-unit}"
missing=""
need() { command -v "$1" >/dev/null 2>&1 || missing="$missing $1"; }

need node
need npm

if [ -n "$missing" ]; then
  echo "::error::Runner is missing:$missing"
  echo "Fix once on the runner host:  sudo apt-get install -y$missing"
  echo "(or add an actions/setup-node@v4 step before this one)"
  exit 1
fi

node -e 'const [maj]=process.versions.node.split(".").map(Number); if(maj<20){console.error("::error::node "+process.versions.node+" is too old; the built-in test runner needs node >= 20"); process.exit(1);}'

echo "preflight ok ($job): node $(node -v), npm $(npm -v)"

if [ "$job" = e2e ]; then
  if [ ! -d node_modules/@playwright/test ]; then
    echo "::error::@playwright/test is not installed"
    echo "Fix in the workflow:  npm ci  (or npm install)"
    exit 1
  fi
  npx playwright --version || {
    echo "::error::Playwright CLI unavailable"
    exit 1
  }
  echo "preflight ok (e2e): playwright present"
fi

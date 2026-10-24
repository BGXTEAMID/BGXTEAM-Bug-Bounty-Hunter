#!/bin/sh
set -eu
python3 - <<'PY'
import sys
if sys.version_info < (3,11): raise SystemExit('Python 3.11+ required')
print('Python version OK')
PY
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[bot,test]'
echo 'Installed. Configure environment variables locally before starting.'

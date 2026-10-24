#!/bin/sh
set -eu
[ "$#" -eq 1 ] || { echo "Usage: $0 backup.tar.gz" >&2; exit 2; }
# Validate archive paths before extraction.
python3 - "$1" <<'PY'
import sys, tarfile
with tarfile.open(sys.argv[1], 'r:gz') as t:
 for m in t.getmembers():
  if m.name.startswith('/') or '..' in m.name.split('/') or not (m.name.startswith('data/') or m.name.startswith('reports/')):
   raise SystemExit('Unsafe archive path rejected: '+m.name)
 t.extractall('.', filter='data')
PY
echo 'Restore complete; inspect files and permissions.'

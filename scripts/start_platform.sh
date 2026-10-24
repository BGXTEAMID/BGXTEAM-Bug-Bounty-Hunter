#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
: "${PORT:=8000}"
exec python -m uvicorn services.api.main:app --host 0.0.0.0 --port "$PORT"

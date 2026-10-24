#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/engine/native/build"
g++ -std=c++17 -O2 -Wall -Wextra -Wpedantic -Wconversion -Wshadow "$ROOT/engine/native/main.cpp" -o "$ROOT/engine/native/build/bgx-native-worker"
( cd "$ROOT/frontend" && npm ci --ignore-scripts && npm run build )
echo "platform build complete"

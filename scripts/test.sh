#!/bin/sh
set -eu
python3 -m compileall -q .
python3 -m pytest -q

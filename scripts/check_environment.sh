#!/bin/sh
set -eu
python3 --version
uname -m
df -h .
python3 - <<'PY'
import importlib.util, shutil, platform
print('platform:', platform.platform())
print('aiogram:', bool(importlib.util.find_spec('aiogram')))
for name in ('nmap','nuclei','httpx','subfinder','dnsx','hydra','john','msfconsole','curl','openssl'):
 print(f'{name}:', shutil.which(name) or 'not found')
PY

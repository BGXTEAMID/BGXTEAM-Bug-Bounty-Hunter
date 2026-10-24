# BGXTEAM Platform Runbook

## Local run

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[api]'
./scripts/build_platform.sh
DEV_PREVIEW=true BGX_NATIVE_WORKER=engine/native/build/bgx-native-worker ./scripts/start_platform.sh
```

Buka `http://127.0.0.1:8000`. Preview mode hanya untuk local operator; production wajib `DEV_PREVIEW=false`, `TELEGRAM_BOT_TOKEN`, dan `ALLOWED_TELEGRAM_IDS`.

## Production run

```bash
./scripts/build_platform.sh
DEV_PREVIEW=false PORT=8000 BGX_NATIVE_WORKER=engine/native/build/bgx-native-worker ./scripts/start_platform.sh
```

Pada production, endpoint native memerlukan `X-Telegram-Init-Data` yang valid. Tidak ada token yang dibundel ke frontend atau image. Target dan scope wajib dimasukkan operator; tidak ada target contoh yang dipakai sebagai execution default.

## Docker

```bash
docker build -f Dockerfile.platform -t bgxteam-platform:3.0.0 .
docker run --rm -p 8000:8000 --env-file .env bgxteam-platform:3.0.0
```

File `data/` dan `logs/` harus dipasang ke volume yang dicadangkan. Build native adalah allowlisted JSONL worker; ia tidak melakukan network access.

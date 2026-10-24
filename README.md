
## Telegram Mini App + Cybersecurity Dashboard

Versi ini juga menyertakan `miniapp/`, sebuah Telegram Mini App dengan dashboard Cybersecurity Command Center. Bot Python existing menjadi entry point melalui `/app`; set `MINI_APP_URL` ke URL HTTPS aplikasi yang sudah dipublish. Mini App memvalidasi `Telegram.WebApp.initData` menggunakan HMAC server-side, memakai file-based JSON store, dan tetap default-deny terhadap scope.

Jalankan preview dashboard secara lokal:

```bash
cd miniapp
DEV_PREVIEW=true npm start
```

Production harus menggunakan `DEV_PREVIEW=false`, `TELEGRAM_BOT_TOKEN`, dan URL HTTPS. Jalankan bot dari root repository setelah `MINI_APP_URL` diisi:

```bash
pip install -e '.[bot]'
python bot.py
```

Dashboard menyediakan overview, jobs, authorized scope, profil sesi Telegram, dry-run assessment, active HTTP dengan konfirmasi eksplisit, polling status, dan detail findings. Fitur exploit, brute force, credential attack, persistence, evasion, dan destructive testing tidak disediakan.

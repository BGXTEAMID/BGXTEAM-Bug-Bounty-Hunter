# TODO — BGXTEAM Cybersecurity Command Center

## Bot Telegram sebagai entry point

- [ ] Bot menyediakan `/start` dan `/app` yang mengirim tombol `web_app` menuju Mini App dari `MINI_APP_URL`.
- [ ] Bot menyediakan `/help` yang menjelaskan bahwa assessment harus berizin, scope wajib, dan mode aktif dibatasi.
- [ ] Bot memberi feedback error jika `TELEGRAM_BOT_TOKEN` atau `MINI_APP_URL` belum dikonfigurasi.

## Validasi sesi dan profil Telegram

- [ ] Mini App memvalidasi Telegram `initData` di backend sebelum memberi akses ke API.
- [ ] Preview browser non-Telegram hanya memakai `DEV_PREVIEW=true` dan menampilkan label Preview.
- [ ] Profil menampilkan identitas Telegram yang sudah tervalidasi dan mode sesi.

## Dashboard operator

- [ ] Dashboard menampilkan ringkasan pekerjaan, status job, hasil terbaru, tombol aksi utama, dan guardrail scope.
- [ ] Tersedia loading, empty, error, dan success states pada alur utama.
- [ ] Dashboard responsive untuk Telegram WebView mobile dan layar lebar.

## Assessment defensif dan scope

- [ ] Peluncuran assessment default dry-run.
- [ ] Active HTTP hanya berjalan pada target yang terdaftar dan melewati scope default-deny.
- [ ] UI menolak scope kosong dan menampilkan alasan target yang ditolak.
- [ ] Tool tidak menyediakan exploit, brute force, credential attack, persistence, evasion, atau destructive testing.

## Jobs dan hasil scan

- [ ] Daftar jobs menampilkan status, progress, waktu, target, dan mode.
- [ ] Detail job menampilkan findings, severity, evidence aman, dan remediation.
- [ ] Job dan findings dipersist melalui file-based store tanpa managed database.
- [ ] User dapat membuat job, melihat detail, dan memantau status polling.

## Project delivery

- [ ] `GET /manus-routes.json` mengembalikan manifest route valid.
- [ ] Server listens on `PORT`/3000 dan menyediakan health endpoint.
- [ ] Build/start command dan preview berjalan di project WebDev.
- [ ] Implementasi disimpan ke GitHub repository BGXTEAM-Bug-Bounty-Hunter tanpa secrets.

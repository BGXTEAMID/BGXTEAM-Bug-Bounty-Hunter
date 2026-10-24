# BGXTEAM Cybersecurity Command Center — Plan

## Tujuan

Menyediakan Telegram Mini App sebagai command center untuk assessment defensif yang berizin. Bot Telegram menjadi pintu masuk melalui tombol `/start` dan `/app`; Mini App memvalidasi sesi Telegram, menampilkan dashboard, membuat pekerjaan dry-run atau active HTTP yang scope-first, memantau status job, dan menampilkan findings dengan bukti aman serta remediation.

## Arsitektur implementasi

- **Frontend**: static HTML/CSS/JavaScript tanpa framework berat agar ringan di Telegram WebView. Telegram WebApp SDK dimuat dari `telegram-web-app.js`; fallback browser preview memakai demo session yang jelas diberi label Preview.
- **Backend**: Node.js HTTP server pada port `PORT` (default 3000), menyajikan `public/` dan API JSON.
- **Persistence**: file-based JSON di `data/miniapp.json`, atomic write, tanpa managed database. Seed data membuat preview langsung bermakna; production data dibuat saat API dipakai.
- **Auth**: `Telegram.WebApp.initData` diverifikasi server-side dengan HMAC SHA-256 memakai `TELEGRAM_BOT_TOKEN`; `DEV_PREVIEW=true` hanya untuk preview lokal dan tidak boleh dipakai production.
- **Jobs**: job in-memory + persisted record. Default dry-run; active HTTP hanya memanggil endpoint internal yang terdaftar, memakai rate limit sederhana, timeout, dan scope default-deny. Tidak ada exploit, brute force, credential attack, persistence, evasion, atau destructive testing.
- **Bot**: `telegram-bot.js` menggunakan Telegram Bot API long polling native `fetch`. `/start` dan `/app` mengirim `web_app` button ke `MINI_APP_URL`; `/help` menjelaskan guardrail. Bot dijalankan sebagai proses terpisah.

## Desain

### Tiga style kandidat

- **Cybernetic Observatory** (0.07): dashboard gelap bernuansa command center dengan cyan telemetry dan amber alert.
- **Paper Audit Console** (0.05): putih, dokumenter, tabel padat dan aksen biru.
- **Neon Terminal** (0.08): hitam murni, glow tinggi, terminal-first.

Dipilih **Cybernetic Observatory**.

### Design Movement

Editorial cyber-operations dashboard: tenang, presisi, dan terasa seperti ruang observasi yang memprioritaskan keputusan operator, bukan dekorasi hacker.

### Core Principles

1. **Signal over noise** — ringkasan health, findings, dan jobs tampil lebih dulu.
2. **Guardrails are visible** — badge “scope enforced”, “dry-run”, dan status authorization selalu terlihat.
3. **Progressive disclosure** — detail temuan dan aktivitas muncul pada panel yang bisa dibuka tanpa mengganggu overview.
4. **Mobile-first density** — layout satu kolom di Telegram WebView, dua kolom di layar lebar.

### Color Philosophy

Midnight navy menjadi ruang tenang untuk data; cyan adalah signature brand color untuk status terverifikasi; violet menandai intelligence; amber dan coral hanya untuk perhatian dan severity sehingga warna punya makna operasional.

### Layout Paradigm

Asymmetric command rail: top bar ringkas, hero status di kiri, quick actions dan latest jobs di kanan, lalu evidence stream memanjang di bawah. Bukan centered marketing grid.

### Signature Elements

- Gridline telemetry halus pada hero.
- Status pills berbentuk capsule dengan dot realtime.
- Panel “Scope gate” yang selalu hadir sebagai safety affordance.

### Interaction Philosophy

Setiap aksi destructive atau active memiliki friction yang disengaja: user harus memilih scope dan konfirmasi authorization. Dry-run menjadi jalur utama. Loading memakai skeleton, error mengarahkan perbaikan, dan empty state selalu memberi langkah berikutnya.

### Animation

Gunakan transisi 160–220ms, count-up ringan pada metrik, pulse kecil hanya pada status running, dan tanpa animasi looping agresif agar tetap nyaman di WebView.

### Typography System

Gunakan `Inter`/system sans untuk UI dan `IBM Plex Mono` untuk identifiers, timestamps, scope, dan evidence. Hierarki: 12px eyebrow, 14px body, 18px panel, 32px hero metric.

### Brand Essence

“Authorized security work, organized for action.” Kepribadian: **precise, calm, accountable**.

### Brand Voice

Headline: “See the signal. Respect the scope.”
CTA: “Run safe assessment” dan “Review finding”.

### Wordmark & Logo

Wordmark BGXTEAM dengan mark berupa radar crosshair empat sudut yang mengunci titik cyan; gunakan sebagai CSS mark agar tidak menambah asset dekoratif.

### Signature Brand Color

`#63E6FF` — cyan telemetry yang menjadi tanda bahwa data telah melewati guardrail.

## Struktur project

- `server.js`: HTTP server, static serving, API routes, auth, job orchestration.
- `telegram-bot.js`: native Telegram Bot API long polling and Mini App entry button.
- `lib/store.js`: atomic file store and seed data.
- `lib/telegram-auth.js`: initData HMAC validation.
- `lib/scope.js`: URL and target scope validation.
- `public/index.html`: Mini App shell and route containers.
- `public/app.js`: client state, Telegram bridge, API calls, renderers, interactions.
- `public/styles.css`: responsive observatory UI.
- `public/manus-routes.json`: WebDev route manifest.


## Tool runner defensif v2.1

Mini App sekarang memiliki tool runner backend nyata: `Offline Scope Audit` menyelesaikan validasi target/scope tanpa network, sedangkan `Safe HTTP Baseline` melakukan satu bounded HTTPS GET untuk target yang sudah diotorisasi. Runner memakai DNS/IP guard, menolak private/reserved/link-local/multicast address, menggunakan IP hasil resolve dengan SNI/Host, tidak mengikuti redirect, serta membatasi timeout dan body. Active HTTP tidak dapat dijalankan dari preview browser dan membutuhkan sesi Telegram tervalidasi plus konfirmasi otorisasi.

Defense-in-depth tambahan meliputi CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, static path confinement, body cap, active concurrency cap, cooldown per operator, audit activity, dan safe failure state. Ini adalah hardening berlapis, bukan jaminan absolut tanpa celah; production tetap membutuhkan review, dependency update, secret rotation, monitoring, dan pengujian staging berizin.

## Platform v3: React + FastAPI + C++ worker

Fondasi platform v3 sekarang tersedia dan runnable melalui [Architecture](ARCHITECTURE.md) dan [Platform Runbook](PLATFORM_RUNBOOK.md). Dashboard React + TypeScript dibuild dengan Vite, API FastAPI menjadi policy boundary, bot Telegram tetap menjadi entry point, dan native C++ worker menerima JSONL allowlisted melalui adapter Python dengan timeout serta output cap. Production execution menolak request tanpa Telegram `initData` yang tervalidasi, mewajibkan scope, dan tidak menjalankan network operation dari native worker.

Jalankan satu platform lokal dengan `./scripts/build_platform.sh` lalu `DEV_PREVIEW=true ./scripts/start_platform.sh`. Gunakan `DEV_PREVIEW=false` di production; target dan scope harus dimasukkan operator, tidak ada execution default ke target contoh.

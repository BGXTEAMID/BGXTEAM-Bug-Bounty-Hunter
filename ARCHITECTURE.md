# BGXTEAM Security Platform Architecture

Platform ini memakai monorepo modular tanpa database tetap. React + TypeScript menangani dashboard; FastAPI menjadi API boundary dan policy enforcement; bot Telegram Python menjadi entry point serta notification adapter; native C++ worker hanya menangani operasi CPU-bound berbasis JSONL yang tidak melakukan network request; JSONL menjadi audit trail append-only lokal.

## Struktur

```text
frontend/                 React + TypeScript dashboard
services/api/             FastAPI application, auth/policy boundary, worker adapter
engine/native/            C++ JSONL worker untuk operasi defensif bounded
bot.py                    Telegram bot entry point
core/                     Python automation dan scheduler existing
storage/                  Atomic JSON store existing
logs/                     Local JSONL audit output
```

API tidak menerima secret dari frontend. Telegram initData diverifikasi di server, role policy tetap default-deny, request dibatasi ukuran dan rate, dan operasi native memiliki allowlist command, timeout, output cap, serta process isolation boundary. C++ tidak dipakai untuk network scanning; `scope_audit` dan `header_policy` hanya memproses structured input. Active HTTP tetap dimiliki tool runner yang sudah memiliki DNS/IP guard.

Deployment berikutnya akan memakai multi-stage build: compile frontend, compile native worker, install Python wheel, lalu FastAPI melayani static dashboard dan `/api`. Migrasi ini mempertahankan Mini App lama selama endpoint compatibility belum selesai; tidak ada cutover diam-diam sebelum smoke test dan rollback checkpoint tersedia.

## Prinsip release

Setiap release wajib melewati Python unit/integration tests, TypeScript build/typecheck, C++ compile plus sanitizer-friendly tests, API contract checks, dependency audit, dan backup/restore rehearsal untuk JSON serta JSONL. Go/Rust hanya ditambahkan bila profiling menunjukkan bottleneck yang tidak sesuai ditangani Python/C++.

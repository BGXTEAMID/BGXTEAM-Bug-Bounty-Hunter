
## Tool runner dan defense-in-depth v2.1

Tool yang dieksekusi server sekarang dibatasi pada `Offline Scope Audit` dan `Safe HTTP Baseline`. Active HTTP hanya bisa dibuat dari sesi Telegram yang tervalidasi; preview browser tidak boleh memicu network request. HTTP baseline menggunakan HTTPS, resolve DNS, menolak private/reserved/link-local/multicast IP, memakai IP hasil resolve dengan SNI dan Host asli, tidak mengikuti redirect, membatasi timeout dan body, serta hanya mengumpulkan response metadata/header. Tidak ada payload injection atau exploit attempt.

Lapisan tambahan mencakup CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, request body cap, static path confinement, active job concurrency cap, per-user cooldown, job audit trail, error-safe completion, dan redacted defensive evidence. Jaminan keamanan absolut tidak diklaim; perubahan tetap perlu code review, dependency updates, secret rotation, logging review, dan authorized staging test.

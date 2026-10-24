
## Tool runner defensif dan defense-in-depth

- [x] Tool catalog menyediakan Offline Scope Audit dan Safe HTTP Baseline.
- [x] Offline Scope Audit benar-benar menyelesaikan job tanpa network request.
- [x] Safe HTTP Baseline aktif hanya dari sesi Telegram tervalidasi dan otorisasi eksplisit.
- [x] Active HTTP menolak private/reserved IP, redirect, HTTPS yang tidak valid, timeout, dan body berlebih.
- [x] Backend menerapkan CSP, response hardening headers, static path confinement, concurrency cap, cooldown, audit activity, dan safe failure state.
- [ ] Tambahkan tool defensif tambahan hanya setelah threat-model dan scope contract masing-masing direview.

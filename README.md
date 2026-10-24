# BGXTEAM BUG BOUNTY HUNTER v2

Toolkit automation security assessment yang **database-free**, lokal, modular, dan scope-first. Fokusnya adalah pengumpulan bukti defensif pada aset yang memang kamu punya izin untuk uji; bukan exploit framework, credential attack, stealth, atau destructive testing.

## Fitur v2

- CLI `bgx scan` dengan mode dry-run sebagai default.
- Active HTTP checks yang hanya berjalan dengan `--active-http`.
- Default-deny scope policy berbasis domain, network, scheme, dan port.
- Bounded concurrency, rate limit, timeout, ukuran body, dan output.
- Redirect dimatikan agar target hasil redirect tidak lolos validasi awal.
- Check defensif untuk security headers dan cookie flags.
- Deduplication finding, secret redaction, serta output JSON, Markdown, dan HTML.
- Scheduler file-based melalui `core.scheduler`, tanpa web app dan tanpa database.
- Telegram entrypoint lama tetap tersedia untuk status/demo offline.

## Instalasi

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e '.[test]'
```

## Quick start aman

Dry-run tidak mengirim request jaringan:

```bash
python bgx.py scan --targets examples/targets.txt --scope examples/scope.json
```

Untuk aset yang memang sudah diotorisasi, aktifkan HTTP check secara eksplisit:

```bash
python bgx.py scan --targets examples/targets.txt \
  --scope examples/scope.json --active-http \
  --format html --out reports/latest.html
```

Atau gunakan domain langsung:

```bash
python bgx.py scan --targets targets.txt --domain app.example.com --active-http --format json --out reports/latest.json
```

`--scope` harus memiliki `domains` atau `networks`. Tidak ada scope berarti proses berhenti. Gunakan `networks` private hanya di lab yang kamu kontrol dan tetap review policy secara manual.

## Automation schedule

Format schedule sederhana:

```json
{
  "targets": "examples/targets.txt",
  "domains": ["example.com"],
  "schemes": ["https"],
  "ports": [443],
  "active_http": false,
  "output": "reports/scheduled-latest.json"
}
```

Jalankan dari cron/systemd sesuai kebutuhan lokal:

```bash
python -c 'from core.scheduler import run_schedule; raise SystemExit(run_schedule("schedule.json"))'
```

## Struktur utama

- `bgx.py`: CLI.
- `core/automation.py`: runner async, rate limiter, transport bounded, checks.
- `core/scheduler.py`: job file-based tanpa database.
- `policies/scope.py`: policy default-deny.
- `findings/engine.py`: normalisasi, fingerprint, dedup, priority internal.
- `reports/generate.py`: JSON/Markdown/HTML sanitized reports.
- `integrations/base.py`: tool detection; active external tools tetap ditolak.

## Batas keamanan

Tool ini tidak menjalankan Nmap, Nuclei, Hydra, John, Metasploit, brute force, exploit, payload injection, persistence, atau evasion. Semua finding adalah indikasi untuk review manusia, bukan bukti exploitability. Jangan masukkan token, cookie, password, atau data pribadi ke target list maupun chat. Network testing harus dilakukan hanya dengan otorisasi tertulis dan sesuai scope program.

## Testing

```bash
python -m compileall -q .
pytest -q
```

Jika `pytest` belum terpasang, gunakan `pip install -e '.[test]'` terlebih dahulu.

# BGXTEAM BUG BOUNTY HUNTER ULTIMATE PRO

Telegram-first, database-free security research assistant. This initial implementation provides a secure core and offline demo; it is not yet a full scanner suite.

## Status

Implemented: strict environment configuration, Telegram allowlist, default-deny scope policy, atomic local JSON store, optional tool detection, active-operation denial, synthetic offline demo, finding normalization/deduplication, basic secret redaction, JSON/Markdown reports, starter Telegram commands, and tests.

Not yet implemented: production network scanner execution, pinned-connection HTTP transport, full callback/menu workflows, program/scope persistence UI, Nuclei/Nmap parsing, full Hydra/John/Metasploit adapters, HTML/CSV/ZIP reports, job recovery, and external AI. These must not be inferred from command names.

## Requirements

Python 3.11+. Core modules use the standard library. Optional bot dependency: `python -m pip install -e '.[bot]'`. Tests: `python -m pip install -e '.[test]'`.

## Setup (Indonesian)

1. Buat bot lewat `@BotFather`, simpan token di environment lokal—jangan kirim token ke chat.
2. Dapatkan Telegram user ID lewat bot ID tepercaya, lalu set `ALLOWED_TELEGRAM_IDS=123456789`. Gunakan ID numerik milik sendiri.
3. Salin `.env.example` ke `.env` dan isi secara lokal. Aplikasi saat ini membaca environment; tidak otomatis membaca `.env`.
4. Buat virtualenv: `python3 -m venv .venv && . .venv/bin/activate`.
5. Install: `pip install -e '.[bot,test]'`.
6. Jalankan tes: `pytest -q`.
7. Jalankan foreground: ekspor environment variables lalu `python bot.py`.

## Security

Production scanning is denied without a non-empty allowlist and token. Scope policy blocks non-global IP addresses unless a separate lab network is explicitly configured. Do not treat URL validation alone as protection against DNS rebinding; any future network adapter must pin/verify the actual connected peer and revalidate every redirect. Active Hydra, John, Nmap and Metasploit operations are not enabled by this starter.

## Android/PRoot notes

Test the app on the actual device before assuming ARM64 compatibility. PRoot may restrict raw sockets, namespaces, process control and some scanners. Install optional tools only after checking package availability, architecture and free disk. No installer upgrades the OS or deletes user files.

## Data and limitations

Local JSON is not a database, but is not a multi-process transaction system. Back up `data/` and reports privately. There is no cross-device sync. Audit logs are not tamper-proof. The demo uses synthetic fixtures and never contacts targets.

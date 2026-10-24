# Platform delivery TODO

## Foundation

- [ ] React + TypeScript dashboard dapat dibuild reproducibly dan menyediakan overview, jobs, scopes, profile, loading, empty, error, dan permission states.
- [ ] FastAPI menyediakan health, architecture, overview, tools, dan scope-audit endpoints dengan validation serta structured errors.
- [ ] C++ worker menerima JSONL terstruktur melalui stdin/stdout, hanya menjalankan operasi allowlisted, bounded, dan tanpa network request.
- [ ] Adapter Python menjalankan worker dengan timeout, output cap, process isolation boundary, dan audit record.

## Security platform

- [ ] Telegram initData diverifikasi server-side dan role-based permission membedakan operator, reviewer, dan admin.
- [ ] Scope management, code/config/header analysis, authorized target workflow, evidence review, dan report export terhubung melalui API contract.
- [ ] Rate limiting, input limits, secret handling, dependency pinning, and security headers aktif pada production path.

## Quality and release

- [ ] Unit, integration, API contract, C++ worker, load smoke, crash recovery, JSON/JSONL backup-restore, lint, typecheck, and dependency checks pass before release.
- [ ] Multi-stage reproducible build, versioned release notes, rollback checkpoint, and operator installation/update documentation are complete.

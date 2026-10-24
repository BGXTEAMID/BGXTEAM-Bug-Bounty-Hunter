"""Strict environment configuration; no secret values are logged."""
from dataclasses import dataclass
import os
from pathlib import Path

def _ids(value: str) -> frozenset[int]:
    if not value.strip(): return frozenset()
    try: return frozenset(int(x.strip()) for x in value.split(",") if x.strip())
    except ValueError as exc: raise ValueError("Telegram ID lists must contain integers") from exc

def _positive(name: str, default: int, minimum: int = 1) -> int:
    try: value = int(os.getenv(name, str(default)))
    except ValueError as exc: raise ValueError(f"{name} must be an integer") from exc
    if value < minimum: raise ValueError(f"{name} must be >= {minimum}")
    return value

@dataclass(frozen=True)
class Config:
    token: str
    allowed_ids: frozenset[int]
    admin_ids: frozenset[int]
    data_dir: Path
    max_jobs: int = 1
    max_rps: int = 1
    max_scan_seconds: int = 60
    max_output_bytes: int = 1_048_576
    max_report_bytes: int = 5_242_880

    @classmethod
    def from_env(cls) -> "Config":
        return cls(os.getenv("TELEGRAM_BOT_TOKEN", "").strip(),
                   _ids(os.getenv("ALLOWED_TELEGRAM_IDS", "")),
                   _ids(os.getenv("ADMIN_TELEGRAM_IDS", "")),
                   Path(os.getenv("DATA_DIR", "./data")).expanduser(),
                   _positive("MAX_CONCURRENT_JOBS", 1), _positive("MAX_REQUESTS_PER_SECOND", 1),
                   _positive("MAX_SCAN_SECONDS", 60), _positive("MAX_OUTPUT_BYTES", 1_048_576),
                   _positive("MAX_REPORT_BYTES", 5_242_880))

    @property
    def production_scanning_enabled(self) -> bool:
        return bool(self.token and self.allowed_ids)

    def authorized(self, user_id: int) -> bool:
        return bool(self.allowed_ids) and user_id in self.allowed_ids

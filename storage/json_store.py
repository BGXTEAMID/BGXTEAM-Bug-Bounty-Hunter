"""Small JSON file store with atomic replacement and path confinement."""
import json, os, tempfile
from pathlib import Path
from threading import RLock

class JsonStore:
    def __init__(self, root: Path):
        self.root = Path(root).resolve(); self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        try: self.root.chmod(0o700)
        except OSError: pass
        self._lock = RLock()
    def _path(self, key: str) -> Path:
        if not key or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for c in key): raise ValueError("invalid storage key")
        path = (self.root / f"{key}.json").resolve()
        if path.parent != self.root: raise ValueError("path escapes storage root")
        return path
    def write(self, key: str, value) -> None:
        path = self._path(key)
        with self._lock:
            fd, tmp = tempfile.mkstemp(prefix=".write-", dir=self.root)
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    json.dump({"schema_version": 1, "data": value}, f, ensure_ascii=False, sort_keys=True)
                    f.flush(); os.fsync(f.fileno())
                os.chmod(tmp, 0o600); os.replace(tmp, path)
            finally:
                if os.path.exists(tmp): os.unlink(tmp)
    def read(self, key: str):
        with self._lock:
            with self._path(key).open(encoding="utf-8") as f: obj = json.load(f)
        if not isinstance(obj, dict) or obj.get("schema_version") != 1 or "data" not in obj: raise ValueError("invalid or unsupported JSON record")
        return obj["data"]

"""Optional external tool adapter; execution is always explicit and bounded."""
from dataclasses import dataclass
import shutil, subprocess

@dataclass(frozen=True)
class ToolStatus:
    name: str
    available: bool
    path: str | None
    version: str | None
    note: str

class ToolAdapter:
    def __init__(self, executable: str, version_args=("--version",), timeout: int = 3, max_output: int = 4096):
        self.executable, self.version_args, self.timeout, self.max_output = executable, tuple(version_args), timeout, max_output
    def status(self) -> ToolStatus:
        path = shutil.which(self.executable)
        if not path: return ToolStatus(self.executable, False, None, None, "optional tool not installed")
        try:
            p = subprocess.run([path, *self.version_args], capture_output=True, text=True, timeout=self.timeout, check=False)
            version = (p.stdout + " " + p.stderr).strip()[:self.max_output] or f"exit={p.returncode}"
            return ToolStatus(self.executable, True, path, version, "detected; active operations remain disabled by default")
        except (OSError, subprocess.TimeoutExpired) as exc:
            return ToolStatus(self.executable, True, path, None, f"version check failed: {type(exc).__name__}")

class ActiveToolAdapter(ToolAdapter):
    def run_active(self, *args, **kwargs):
        raise PermissionError("active testing is disabled in the base build; configure an isolated lab policy and explicit reviewed adapter first")

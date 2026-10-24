from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path


class NativeEngineError(RuntimeError):
    pass


class NativeEngine:
    def __init__(self, binary: Path | None = None, timeout_seconds: float = 2.0, max_output_bytes: int = 128 * 1024):
        self.binary = binary or Path(os.getenv("BGX_NATIVE_WORKER", "engine/native/bgx-native-worker"))
        self.timeout_seconds = timeout_seconds
        self.max_output_bytes = max_output_bytes

    def analyze(self, operation: str, payload: dict) -> dict:
        if operation not in {"scope_audit", "header_policy"}:
            raise NativeEngineError("operation-not-allowlisted")
        request = {"operation": operation, "payload": payload}
        if not self.binary.exists():
            raise NativeEngineError("native-worker-not-built")
        try:
            result = subprocess.run(
                [str(self.binary)], input=json.dumps(request) + "\n", text=True,
                capture_output=True, timeout=self.timeout_seconds, check=False,
                env={"PATH": os.getenv("PATH", "")},
            )
        except subprocess.TimeoutExpired as exc:
            raise NativeEngineError("native-worker-timeout") from exc
        if len(result.stdout.encode()) > self.max_output_bytes:
            raise NativeEngineError("native-worker-output-too-large")
        if result.returncode != 0:
            raise NativeEngineError("native-worker-failed")
        try:
            response = json.loads(result.stdout.splitlines()[-1])
        except (IndexError, json.JSONDecodeError) as exc:
            raise NativeEngineError("native-worker-invalid-response") from exc
        if not response.get("ok"):
            raise NativeEngineError(str(response.get("error", "native-worker-rejected")))
        return response

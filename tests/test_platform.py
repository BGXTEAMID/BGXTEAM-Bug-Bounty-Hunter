import os
from pathlib import Path

os.environ.setdefault("DEV_PREVIEW", "true")
os.environ.setdefault("BGX_NATIVE_WORKER", str(Path("engine/native/build/bgx-native-worker")))

from fastapi.testclient import TestClient
from services.api.main import app


def test_health_and_architecture():
    client = TestClient(app)
    assert client.get("/health").status_code == 200
    assert client.get("/api/architecture").json()["api"] == "fastapi"


def test_native_scope_audit_requires_scope_and_executes():
    client = TestClient(app)
    response = client.post("/api/engine/analyze", json={"operation": "scope_audit", "target": "https://authorized.example", "scope_targets": ["authorized.example"]})
    assert response.status_code == 200
    assert response.json()["result"]["network_used"] is False
    rejected = client.post("/api/engine/analyze", json={"operation": "scope_audit", "target": "https://outside.example", "scope_targets": ["authorized.example"]})
    assert rejected.status_code == 400


def test_invalid_operation_is_schema_rejected():
    client = TestClient(app)
    response = client.post("/api/engine/analyze", json={"operation": "network_scan", "target": "https://authorized.example", "scope_targets": ["authorized.example"]})
    assert response.status_code == 422

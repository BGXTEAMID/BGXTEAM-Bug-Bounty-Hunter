from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .engine import NativeEngine, NativeEngineError
from .auth import require_operator
from policies.scope import ScopeDenied, ScopePolicy

app = FastAPI(title="BGXTEAM Security Platform API", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")], allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["content-type", "x-telegram-init-data"])
engine = NativeEngine()


class ScopeAuditRequest(BaseModel):
    operation: Literal["scope_audit", "header_policy"] = "scope_audit"
    target: str = Field(min_length=1, max_length=2048)
    scope_targets: list[str] = Field(default_factory=list, max_length=100)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["x-content-type-options"] = "nosniff"
    response.headers["referrer-policy"] = "no-referrer"
    response.headers["permissions-policy"] = "camera=(), microphone=(), geolocation=()"
    return response


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "bgx-platform-api", "version": app.version, "native_worker": engine.binary.exists()}


@app.get("/api/architecture")
def architecture() -> dict:
    return {"frontend": "react-typescript", "api": "fastapi", "bot": "python-telegram", "native_engine": "cpp-jsonl", "storage": "json-jsonl", "database": False}


@app.get("/api/tools")
def tools() -> dict:
    return {"tools": [{"id": "offline-scope-audit", "execution": "native", "network_used": False}, {"id": "safe-http-baseline", "execution": "python-policy-boundary", "network_used": "explicit-only"}]}


@app.post("/api/engine/analyze")
def analyze(request: ScopeAuditRequest, operator: dict = Depends(require_operator)) -> dict:
    if not request.scope_targets:
        raise HTTPException(status_code=400, detail={"error": "scope-required", "message": "At least one authorized scope target is required."})
    try:
        ScopePolicy(domains=frozenset(request.scope_targets), schemes=frozenset({"https"}), ports=frozenset({443})).validate_url(request.target)
    except (ScopeDenied, ValueError) as exc:
        raise HTTPException(status_code=400, detail={"error": "target-outside-scope", "message": str(exc)}) from exc
    try:
        result = engine.analyze(request.operation, request.model_dump())
    except NativeEngineError as exc:
        raise HTTPException(status_code=503, detail={"error": str(exc), "safe_failure": True}) from exc
    return {"ok": True, "result": result, "audit": {"network_used": False, "operation": request.operation, "operator_role": operator["role"]}}


frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dist.exists():
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

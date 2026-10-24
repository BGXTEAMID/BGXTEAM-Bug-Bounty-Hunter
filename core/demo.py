"""Offline-only synthetic demo; never makes network requests."""
from datetime import datetime, timezone
import uuid

def run_demo():
    now = datetime.now(timezone.utc).isoformat()
    findings = [{"id": "DEMO-001", "title": "Missing Content-Security-Policy header", "target": "https://demo.invalid", "severity": "low", "confidence": "medium", "state": "Potential", "evidence": "Synthetic fixture only", "remediation": "Define a restrictive Content-Security-Policy appropriate to the application.", "timestamp": now, "source": "offline-demo"}]
    return {"job_id": "demo-" + uuid.uuid4().hex[:8], "mode": "offline-demo", "targets": ["demo.invalid"], "findings": findings, "network_used": False}

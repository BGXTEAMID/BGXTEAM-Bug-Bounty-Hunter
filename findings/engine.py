"""Canonical findings, stable deduplication and explicitly non-CVSS priority."""
import hashlib, json

def normalize(finding: dict) -> dict:
    required = ("title", "target", "severity", "evidence")
    if any(not finding.get(k) for k in required): raise ValueError("finding missing required fields")
    out = dict(finding)
    fp = {k: str(out.get(k, "")).strip().lower() for k in ("target", "category", "endpoint", "scanner", "evidence")}
    out.setdefault("id", "F-" + hashlib.sha256(json.dumps(fp, sort_keys=True).encode()).hexdigest()[:12])
    out.setdefault("state", "Needs Review"); out.setdefault("confidence", "low")
    return out

def priority(finding: dict) -> int:
    sev = {"critical": 40, "high": 30, "medium": 20, "low": 10, "info": 0}.get(str(finding.get("severity", "")).lower(), 0)
    conf = {"high": 3, "medium": 2, "low": 1}.get(str(finding.get("confidence", "low")).lower(), 1)
    return sev + conf  # Internal triage score, not CVSS.

def deduplicate(findings):
    result, seen = [], set()
    for f in findings:
        item = normalize(f); key = item["id"]
        if key not in seen: seen.add(key); result.append(item)
    return result

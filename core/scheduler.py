"""Small file-backed scheduler for authorized, repeatable local jobs."""
from __future__ import annotations
import asyncio, json
from datetime import datetime, timezone
from pathlib import Path
from core.automation import AutomationRunner, load_targets
from policies.scope import ScopePolicy
from reports.generate import json_report


def run_schedule(path: str) -> int:
    spec = json.loads(Path(path).read_text(encoding="utf-8"))
    policy = ScopePolicy(domains=frozenset(spec.get("domains", [])), networks=tuple(spec.get("networks", [])),
                         schemes=frozenset(spec.get("schemes", ["https"])), ports=frozenset(spec.get("ports", [80, 443])))
    runner = AutomationRunner(policy)
    data = asyncio.run(runner.run(load_targets(spec["targets"]), active=bool(spec.get("active_http", False))))
    out = Path(spec.get("output", "reports/scheduled-latest.json"))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json_report({**data, "scheduled_at": datetime.now(timezone.utc).isoformat()}), encoding="utf-8")
    return len(data.get("errors", []))

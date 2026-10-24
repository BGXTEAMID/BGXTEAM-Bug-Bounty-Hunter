import asyncio
import json
from pathlib import Path

from core.automation import AutomationRunner, ScanOptions, load_targets
from policies.scope import ScopePolicy
from reports.generate import html_report


def test_dry_run_never_uses_network():
    policy = ScopePolicy(domains=frozenset({"example.com"}), schemes=frozenset({"https"}))
    result = asyncio.run(AutomationRunner(policy).run(["https://example.com"], active=False))
    assert result["network_used"] is False
    assert result["mode"] == "dry-run"


def test_out_of_scope_target_is_rejected_without_network():
    policy = ScopePolicy(domains=frozenset({"example.com"}), schemes=frozenset({"https"}))
    result = asyncio.run(AutomationRunner(policy).run(["https://evil.example.net"], active=False))
    assert result["targets"] == []
    assert result["errors"][0]["type"] == "scope-denied"


def test_targets_json_loader(tmp_path: Path):
    path = tmp_path / "targets.json"
    path.write_text(json.dumps({"targets": ["https://example.com"]}), encoding="utf-8")
    assert load_targets(str(path)) == ["https://example.com"]


def test_html_report_escapes_untrusted_content():
    output = html_report({"mode": "dry-run", "findings": [{"title": "<script>alert(1)</script>"}]})
    assert "<script>alert(1)</script>" not in output
    assert "&lt;script&gt;" in output

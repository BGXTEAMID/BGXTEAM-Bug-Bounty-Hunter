import json, pytest
from pathlib import Path
from policies.scope import ScopePolicy, ScopeDenied
from storage.json_store import JsonStore
from core.config import Config
from core.demo import run_demo
from findings.engine import normalize, deduplicate, priority
from reports.generate import json_report, markdown_report, redact
from integrations.base import ActiveToolAdapter

def test_config_default_deny(monkeypatch, tmp_path):
    for k in ["TELEGRAM_BOT_TOKEN", "ALLOWED_TELEGRAM_IDS", "ADMIN_TELEGRAM_IDS"]: monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("DATA_DIR", str(tmp_path)); c=Config.from_env(); assert not c.production_scanning_enabled and not c.authorized(1)
def test_scope_exact_and_subdomain():
    p=ScopePolicy(domains=frozenset({"example.com"}), schemes=frozenset({"https"}))
    assert p.validate_url("https://a.example.com") == "a.example.com"
    with pytest.raises(ScopeDenied): p.validate_url("https://example.com.evil.test")
    with pytest.raises(ScopeDenied): p.validate_url("http://example.com")
def test_scope_private_blocked():
    p=ScopePolicy(domains=frozenset({"127.0.0.1"}), networks=("127.0.0.0/8",), schemes=frozenset({"http"}))
    with pytest.raises(ScopeDenied): p.validate_url("http://127.0.0.1")
def test_json_store_atomic_and_key_guard(tmp_path):
    s=JsonStore(tmp_path); s.write("sample", {"ok": True}); assert s.read("sample")=={"ok":True}
    with pytest.raises(ValueError): s.write("../escape", {})
def test_findings_and_priority():
    f={"title":"Issue", "target":"https://example.com", "severity":"high", "evidence":"synthetic", "confidence":"high"}
    assert normalize(f)["id"] == normalize(f)["id"] and len(deduplicate([f,f])) == 1 and priority(f) == 33
def test_redaction_and_report():
    s=json_report({"token":"abc", "findings":[{"title":"x", "evidence":"api_key=secret123"}]})
    assert "secret123" not in s and "[REDACTED]" in s
    assert "BGXTEAM" in markdown_report({"findings":[]})
def test_demo_offline():
    d=run_demo(); assert d["network_used"] is False and d["findings"][0]["id"] == "DEMO-001"
def test_active_adapter_denied():
    with pytest.raises(PermissionError): ActiveToolAdapter("nmap").run_active("127.0.0.1")

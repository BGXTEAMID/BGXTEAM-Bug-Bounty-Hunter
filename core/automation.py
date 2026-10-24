"""Safe, scope-first automation pipeline for authorized HTTP assessments."""
from __future__ import annotations

import asyncio
import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable

from findings.engine import deduplicate
from policies.scope import ScopeDenied, ScopePolicy


@dataclass(frozen=True)
class ScanOptions:
    timeout: float = 10.0
    max_body_bytes: int = 256_000
    concurrency: int = 4
    requests_per_second: float = 1.0
    user_agent: str = "BGXTEAM-BBH/2.0 (authorized-assessment)"


class RateLimiter:
    def __init__(self, rate: float) -> None:
        if rate <= 0:
            raise ValueError("requests_per_second must be positive")
        self.delay = 1.0 / rate
        self._lock = asyncio.Lock()
        self._last = 0.0

    async def wait(self) -> None:
        async with self._lock:
            now = time.monotonic()
            pause = self.delay - (now - self._last)
            if pause > 0:
                await asyncio.sleep(pause)
            self._last = time.monotonic()


class SafeHTTPClient:
    """Bounded GET client; redirects are intentionally disabled."""

    def __init__(self, options: ScanOptions) -> None:
        self.options = options

    def get(self, url: str) -> dict[str, Any]:
        request = urllib.request.Request(
            url,
            headers={"User-Agent": self.options.user_agent, "Accept": "text/html,application/xhtml+xml,*/*;q=0.1"},
            method="GET",
        )
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None
        opener = urllib.request.build_opener(NoRedirect)
        try:
            with opener.open(request, timeout=self.options.timeout) as response:
                body = response.read(self.options.max_body_bytes + 1)
                return {
                    "status": response.status,
                    "headers": {k.lower(): v for k, v in response.headers.items()},
                    "body": body[: self.options.max_body_bytes],
                    "truncated": len(body) > self.options.max_body_bytes,
                    "final_url": response.geturl(),
                }
        except urllib.error.HTTPError as exc:
            return {"status": exc.code, "headers": {k.lower(): v for k, v in exc.headers.items()}, "body": b"", "error": str(exc)}


class HeaderCheck:
    name = "http-security-headers"

    def run(self, target: str, response: dict[str, Any]) -> list[dict[str, Any]]:
        headers = response.get("headers", {})
        missing = []
        for header, title, severity, remediation in (
            ("content-security-policy", "Missing Content-Security-Policy", "medium", "Define a restrictive CSP appropriate to the application."),
            ("strict-transport-security", "Missing Strict-Transport-Security", "low", "Enable HSTS after confirming HTTPS is enforced safely."),
            ("x-content-type-options", "Missing X-Content-Type-Options", "low", "Set X-Content-Type-Options: nosniff."),
            ("referrer-policy", "Missing Referrer-Policy", "low", "Set a privacy-preserving Referrer-Policy."),
        ):
            if not headers.get(header):
                missing.append({"title": title, "target": target, "category": "security-headers", "severity": severity,
                                "confidence": "high", "state": "Needs Review", "evidence": f"HTTP {response.get('status')}; header absent",
                                "remediation": remediation, "scanner": self.name})
        return missing


class CookieCheck:
    name = "cookie-flags"

    def run(self, target: str, response: dict[str, Any]) -> list[dict[str, Any]]:
        raw = response.get("headers", {}).get("set-cookie", "")
        if not raw:
            return []
        findings = []
        lowered = raw.lower()
        if "secure" not in lowered:
            findings.append({"title": "Cookie without Secure attribute", "target": target, "category": "cookies", "severity": "medium", "confidence": "medium", "state": "Needs Review", "evidence": "Set-Cookie response lacks Secure", "remediation": "Mark sensitive cookies Secure over HTTPS.", "scanner": self.name})
        if "httponly" not in lowered:
            findings.append({"title": "Cookie without HttpOnly attribute", "target": target, "category": "cookies", "severity": "medium", "confidence": "medium", "state": "Needs Review", "evidence": "Set-Cookie response lacks HttpOnly", "remediation": "Mark session cookies HttpOnly unless client-side access is required.", "scanner": self.name})
        return findings


class AutomationRunner:
    def __init__(self, policy: ScopePolicy, options: ScanOptions | None = None) -> None:
        self.policy = policy
        self.options = options or ScanOptions()
        if self.options.concurrency < 1:
            raise ValueError("concurrency must be positive")
        self.client = SafeHTTPClient(self.options)
        self.checks = (HeaderCheck(), CookieCheck())

    async def run(self, targets: Iterable[str], *, active: bool = False) -> dict[str, Any]:
        unique = list(dict.fromkeys(targets))
        validated: list[str] = []
        errors: list[dict[str, str]] = []
        for target in unique:
            try:
                self.policy.validate_url(target, resolve_dns=active)
                validated.append(target)
            except ScopeDenied as exc:
                errors.append({"target": target, "error": str(exc), "type": "scope-denied"})
        result: dict[str, Any] = {"mode": "active-http" if active else "dry-run", "targets": validated, "findings": [], "errors": errors, "network_used": False}
        if not active:
            result["note"] = "Dry-run only. Use --active-http only for targets you are authorized to assess."
            return result
        limiter = RateLimiter(self.options.requests_per_second)
        semaphore = asyncio.Semaphore(self.options.concurrency)

        async def one(target: str) -> list[dict[str, Any]]:
            async with semaphore:
                await limiter.wait()
                try:
                    response = await asyncio.to_thread(self.client.get, target)
                    findings: list[dict[str, Any]] = []
                    for check in self.checks:
                        findings.extend(check.run(target, response))
                    return findings
                except (OSError, urllib.error.URLError, TimeoutError) as exc:
                    return [{"title": "Target request failed", "target": target, "severity": "info", "confidence": "high", "state": "Needs Review", "evidence": type(exc).__name__, "remediation": "Review connectivity and authorization; no exploit was attempted.", "scanner": "transport"}]

        batches = await asyncio.gather(*(one(target) for target in validated))
        result["findings"] = deduplicate([finding for batch in batches for finding in batch])
        result["network_used"] = bool(validated)
        result["completed_at"] = datetime.now(timezone.utc).isoformat()
        return result


def load_targets(path: str) -> list[str]:
    with open(path, encoding="utf-8") as handle:
        if path.endswith(".json"):
            data = json.load(handle)
            values = data.get("targets", data) if isinstance(data, dict) else data
        else:
            values = [line.strip() for line in handle if line.strip() and not line.lstrip().startswith("#")]
    if not isinstance(values, list) or any(not isinstance(value, str) for value in values):
        raise ValueError("targets must be a list of URL strings")
    return values

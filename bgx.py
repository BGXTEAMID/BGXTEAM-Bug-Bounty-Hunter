#!/usr/bin/env python3
"""BGXTEAM Bug Bounty Hunter command line automation."""
from __future__ import annotations
import argparse, asyncio, json, sys
from pathlib import Path
from core.automation import AutomationRunner, ScanOptions, load_targets
from policies.scope import ScopePolicy
from reports.generate import html_report, json_report, markdown_report


def policy_from_args(args: argparse.Namespace) -> ScopePolicy:
    config = json.loads(Path(args.scope).read_text(encoding="utf-8")) if args.scope else {}
    domains = set(config.get("domains", [])) | set(args.domain or [])
    networks = tuple(config.get("networks", []))
    schemes = frozenset(config.get("schemes", ["https"]))
    ports = frozenset(config.get("ports", [80, 443]))
    if not domains and not networks:
        raise SystemExit("Scope kosong. Isi --domain atau --scope; default-deny aktif.")
    return ScopePolicy(domains=frozenset(domains), networks=networks, schemes=schemes, ports=ports,
                       allow_private_lab=bool(config.get("allow_private_lab", False)))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="bgx", description="Scope-first authorized security assessment automation")
    sub = parser.add_subparsers(dest="command", required=True)
    scan = sub.add_parser("scan", help="Run safe HTTP checks")
    scan.add_argument("--targets", required=True, help="Text file or JSON file containing URLs")
    scan.add_argument("--scope", help="JSON scope policy")
    scan.add_argument("--domain", action="append", help="Allowed domain; repeatable")
    scan.add_argument("--active-http", action="store_true", help="Actually send bounded GET requests")
    scan.add_argument("--concurrency", type=int, default=4)
    scan.add_argument("--rps", type=float, default=1.0)
    scan.add_argument("--timeout", type=float, default=10.0)
    scan.add_argument("--format", choices=("json", "md", "html"), default="md")
    scan.add_argument("--out", help="Output report path; stdout when omitted")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "scan":
        targets = load_targets(args.targets)
        policy = policy_from_args(args)
        options = ScanOptions(timeout=args.timeout, concurrency=args.concurrency, requests_per_second=args.rps)
        data = asyncio.run(AutomationRunner(policy, options).run(targets, active=args.active_http))
        output = {"json": json_report, "md": markdown_report, "html": html_report}[args.format](data)
        if args.out:
            Path(args.out).parent.mkdir(parents=True, exist_ok=True)
            Path(args.out).write_text(output, encoding="utf-8")
            print(f"Report written: {args.out}")
        else:
            print(output)
        return 0 if not data.get("errors") else 2
    return 1

if __name__ == "__main__":
    sys.exit(main())

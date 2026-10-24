from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from urllib.parse import parse_qsl

from fastapi import Header, HTTPException


def _allowed_ids() -> set[int]:
    return {int(value.strip()) for value in os.getenv("ALLOWED_TELEGRAM_IDS", "").split(",") if value.strip().isdigit()}


def verify_init_data(init_data: str) -> dict:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    if not token or not init_data:
        raise ValueError("telegram-session-required")
    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received = pairs.pop("hash", "")
    auth_date = int(pairs.get("auth_date", "0"))
    if not received or abs(time.time() - auth_date) > 86400:
        raise ValueError("telegram-session-expired")
    data_check = "\n".join(f"{key}={value}" for key, value in sorted(pairs.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received):
        raise ValueError("telegram-signature-invalid")
    user = json.loads(pairs.get("user", "{}"))
    user_id = int(user.get("id", 0))
    if user_id not in _allowed_ids():
        raise ValueError("telegram-user-not-allowlisted")
    return {"id": user_id, "role": "admin" if user_id in {int(value.strip()) for value in os.getenv("ADMIN_TELEGRAM_IDS", "").split(",") if value.strip().isdigit()} else "operator"}


def require_operator(x_telegram_init_data: str | None = Header(default=None)) -> dict:
    if os.getenv("DEV_PREVIEW", "false").lower() == "true":
        return {"id": 0, "role": "operator", "mode": "preview"}
    try:
        return verify_init_data(x_telegram_init_data or "")
    except (ValueError, json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=401, detail={"error": str(exc), "message": "Verified Telegram Mini App session required."}) from exc

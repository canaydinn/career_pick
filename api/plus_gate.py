"""
Plus plan kapisi — CV gap / ilan uyumu API'leri icin.
Authorization: Bearer <supabase access_token>
profiles.plan == 'plus' (suresi dolmamis) gerekir.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone


def bearer_from_headers(headers) -> str:
    h = headers.get("Authorization") or headers.get("authorization") or ""
    if isinstance(h, bytes):
        h = h.decode("utf-8", errors="ignore")
    h = str(h).strip()
    if h.lower().startswith("bearer "):
        return h[7:].strip()
    return ""


def _iso_expired(expires: str | None) -> bool:
    if not expires:
        return False
    try:
        raw = str(expires).replace("Z", "+00:00")
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt < datetime.now(timezone.utc)
    except Exception:
        return False


def require_plus(headers) -> tuple[bool, int, dict]:
    """
    Returns (ok, http_status, payload).
    ok=True iken payload: { user_id, plan }
    """
    token = bearer_from_headers(headers)
    if not token:
        return False, 401, {
            "ok": False,
            "error": "Unauthorized",
            "code": "auth_required",
        }

    base = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    anon = os.environ.get("SUPABASE_ANON_KEY") or ""
    service = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not base or not anon or not service:
        return False, 503, {
            "ok": False,
            "error": "Sunucu yapilandirmasi eksik.",
            "code": "config",
        }

    try:
        req = urllib.request.Request(
            base + "/auth/v1/user",
            headers={
                "apikey": anon,
                "Authorization": "Bearer " + token,
            },
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            user = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError:
        return False, 401, {"ok": False, "error": "Unauthorized", "code": "auth_invalid"}
    except Exception:
        return False, 401, {"ok": False, "error": "Unauthorized", "code": "auth_error"}

    user_id = user.get("id") if isinstance(user, dict) else None
    if not user_id:
        return False, 401, {"ok": False, "error": "Unauthorized", "code": "auth_invalid"}

    try:
        req = urllib.request.Request(
            base + "/rest/v1/profiles?id=eq." + str(user_id) + "&select=plan,plan_expires_at",
            headers={
                "apikey": service,
                "Authorization": "Bearer " + service,
                "Accept": "application/json",
            },
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return False, 503, {
            "ok": False,
            "error": "Plan dogrulanamadi.",
            "code": "plan_lookup",
        }

    if not isinstance(rows, list) or not rows:
        return False, 403, {
            "ok": False,
            "error": "plus_required",
            "code": "plus_required",
            "plan": "free",
        }

    plan = (rows[0].get("plan") or "free")
    if plan == "plus" and _iso_expired(rows[0].get("plan_expires_at")):
        plan = "free"

    if plan != "plus":
        return False, 403, {
            "ok": False,
            "error": "plus_required",
            "code": "plus_required",
            "plan": plan or "free",
        }

    return True, 200, {"user_id": user_id, "plan": "plus"}

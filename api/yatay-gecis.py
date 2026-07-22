"""
CareerPick — Yatay gecis onerileri (Sikistin mi?)
=================================================
POST /api/yatay-gecis

Govde: { mevcut_rol: "..." }

Donen:
  { ok, suggestions: [{ hedef_rol, gerekce }], meslek_adi? }

Bagimsiz kesif ozelligi. Eslesme yok / dusuk guven / hata → bos liste
(UI bolumu gizlenir). Roadmap / ilan / meta-senaryo akislarina dokunmaz.
"""

import os
import json
import time
from http.server import BaseHTTPRequestHandler

from openai import OpenAI
from qdrant_client import QdrantClient

try:
    from gecis_haritasi import eslestir
except ImportError:
    from api.gecis_haritasi import eslestir

RATE_LIMIT_MAX = 20
RATE_LIMIT_WIN = 60
_RATE_BUCKET = {}


def _clients():
    o = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    q = QdrantClient(url=os.environ["QDRANT_URL"], api_key=os.environ["QDRANT_API_KEY"], timeout=60)
    return o, q


def _normalize_yatay(raw, limit=4):
    """yatay_gecisler → [{hedef_rol, gerekce}] (2-4 icin caller karar verir)."""
    if not isinstance(raw, list):
        return []
    out = []
    seen = set()
    for item in raw:
        if len(out) >= limit:
            break
        if isinstance(item, dict):
            hedef = str(
                item.get("hedef_rol")
                or item.get("rol_adi")
                or item.get("hedef")
                or ""
            ).strip()[:120]
            gerekce = str(item.get("gerekce") or item.get("neden") or "").strip()[:280]
        else:
            hedef = str(item or "").strip()[:120]
            gerekce = ""
        if not hedef:
            continue
        key = hedef.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append({"hedef_rol": hedef, "gerekce": gerekce})
    return out


def oner_yatay_gecis(mevcut_rol):
    """
    mevcut_rol → kariyer_gecis_haritasi eslestir → yatay_gecisler.
    Hata / eslesme yok / yetersiz liste → suggestions=[].
    """
    rol = str(mevcut_rol or "").strip()[:200]
    if len(rol) < 2:
        return {"ok": True, "suggestions": []}

    try:
        o, q = _clients()
    except KeyError as e:
        print("[ERROR] yatay-gecis env:", str(e))
        return {"ok": True, "suggestions": []}

    try:
        # veri_notu dusuk guven → eslestir None doner
        eslesme = eslestir(rol, o, q)
    except Exception as e:
        print("[ERROR] yatay-gecis eslestir (yutulan):", repr(e))
        return {"ok": True, "suggestions": []}

    if not eslesme:
        return {"ok": True, "suggestions": []}

    suggestions = _normalize_yatay(eslesme.get("yatay_gecisler"), limit=4)
    # 2-4 arasi goster; 2'den azsa UI bolumu gizlensin diye bos don
    if len(suggestions) < 2:
        return {
            "ok": True,
            "suggestions": [],
            "meslek_adi": eslesme.get("meslek_adi") or "",
        }

    return {
        "ok": True,
        "meslek_adi": eslesme.get("meslek_adi") or "",
        "suggestions": suggestions[:4],
    }


def _allowed_origin(origin):
    raw = os.environ.get("ALLOWED_ORIGINS", "")
    allow = [o.strip() for o in raw.split(",") if o.strip()]
    return origin if (origin and origin in allow) else ""


def _rate_limited(ip):
    now = time.time()
    bucket = [t for t in _RATE_BUCKET.get(ip, []) if now - t < RATE_LIMIT_WIN]
    if len(bucket) >= RATE_LIMIT_MAX:
        _RATE_BUCKET[ip] = bucket
        return True
    bucket.append(now)
    _RATE_BUCKET[ip] = bucket
    return False


class handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _cors(self):
        allowed = _allowed_origin(self.headers.get("Origin", ""))
        if allowed:
            self.send_header("Access-Control-Allow-Origin", allowed)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        ip = (self.headers.get("x-forwarded-for", "") or "anon").split(",")[0].strip()
        if _rate_limited(ip):
            return self._json(429, {"ok": False, "error": "Cok fazla istek. Lutfen biraz bekleyin."})

        try:
            length = int(self.headers.get("Content-Length", 0))
        except (TypeError, ValueError):
            length = 0
        if length <= 0 or length > 8_000:
            return self._json(400, {"ok": False, "error": "Gecersiz istek govdesi."})

        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return self._json(400, {"ok": False, "error": "Gecersiz JSON."})

        mevcut_rol = str((data or {}).get("mevcut_rol") or "").strip()[:200]
        try:
            return self._json(200, oner_yatay_gecis(mevcut_rol))
        except Exception as e:
            print("[ERROR] yatay-gecis:", repr(e))
            return self._json(200, {"ok": True, "suggestions": []})

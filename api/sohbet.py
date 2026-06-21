"""
CareerPick — Kariyer Sohbeti backend (Vercel Serverless Function)
=================================================================
POST /api/sohbet

Iki islem (action) destekler:

1) action="evaluate"
   Govde: { action, soru, cevap }
   Donen: { sufficient: bool, followup: str }
   Bir form sorusuna verilen yanitin yeterince bilgi icerip icermedigini
   Claude ile degerlendirir; yetersizse kibar bir takip sorusu uretir.

2) action="recommend"
   Govde: { action, cevaplar: [ { soru, cevap } ] }
   Donen: { recommendations: [ { ad, kurum, aciklama, sure, gerekce, link } ] }
   Kullanici profiline gore edupick_egitimler koleksiyonundan (RAG) uygun
   egitimleri secip kart verisi uretir.

Ortam degiskenleri: OPENAI_API_KEY, ANTHROPIC_API_KEY, QDRANT_URL,
QDRANT_API_KEY, (ops.) CLAUDE_MODEL, ALLOWED_ORIGINS
"""

import os
import json
import re
import time
from http.server import BaseHTTPRequestHandler

from openai import OpenAI
from anthropic import Anthropic
from qdrant_client import QdrantClient

EGITIM_COLLECTION = "edupick_egitimler"
EMBEDDING_MODEL   = "text-embedding-3-large"
CLAUDE_MODEL      = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")

MAX_FIELD_LEN  = 4000
MAX_BODY_LEN   = 60_000
RATE_LIMIT_MAX = 30
RATE_LIMIT_WIN = 60
_RATE_BUCKET = {}


def _clients():
    a = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    o = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    q = QdrantClient(url=os.environ["QDRANT_URL"], api_key=os.environ["QDRANT_API_KEY"], timeout=60)
    return a, o, q


# ── Is mantigi ────────────────────────────────────────────────────────────────

def degerlendir(soru, cevap, a):
    prompt = f"""Bir kariyer formundaki yaniti degerlendiriyorsun.

SORU: {soru}
KULLANICI YANITI: {cevap}

Bu yanit, soruyu anlamli bir sekilde cevaplayacak kadar bilgi iceriyor mu?
Cok kisa, belirsiz, alakasiz ya da "bilmiyorum" gibi yanitlar yetersizdir.

Sadece su JSON formatinda dondur:
{{"sufficient": true veya false, "followup": "<yetersizse kibar ve kisa bir takip sorusu, yeterliyse bos birak>"}}"""
    r = a.messages.create(
        model=CLAUDE_MODEL, max_tokens=250,
        messages=[{"role": "user", "content": prompt}],
    )
    txt = r.content[0].text.strip()
    mm = re.search(r"\{.*\}", txt, re.DOTALL)
    if mm:
        try:
            d = json.loads(mm.group())
            return {"sufficient": bool(d.get("sufficient", True)),
                    "followup": (d.get("followup") or "").strip()}
        except Exception:
            pass
    # Cozumlenemezse akisi tikamamak icin yeterli say.
    return {"sufficient": True, "followup": ""}


def egitim_ara(arama_metni, o, q, limit=8):
    emb = o.embeddings.create(model=EMBEDDING_MODEL, input=[arama_metni]).data[0].embedding
    res = q.query_points(collection_name=EGITIM_COLLECTION, query=emb,
                         limit=limit, with_payload=True).points
    kurslar = []
    for p in res:
        pl = p.payload or {}
        kurslar.append({
            "ad":       pl.get("kurs_egitim_adi") or pl.get("baslik") or "",
            "kurum":    pl.get("kurum_adi") or "",
            "kategori": pl.get("kategori") or "",
            "sehir":    pl.get("sehir") or "",
            "link":     pl.get("sayfa_linki") or pl.get("link") or "",
        })
    return kurslar


def oner(cevaplar, a, o, q):
    arama = " ".join((c.get("cevap") or "") for c in cevaplar).strip() or "kariyer egitimi"
    kurslar = egitim_ara(arama, o, q, limit=8)
    if not kurslar:
        return []

    profil = "\n".join(f"- {c.get('soru','')}: {c.get('cevap','')}" for c in cevaplar)
    kurs_json = json.dumps(kurslar, ensure_ascii=False)

    sistem = """Sen CareerPick platformunun kariyer danismanisin. Kullanicinin profiline
gore, SADECE verilen egitim listesinden en uygun 4-6 tanesini sec. Listede olmayan
egitim UYDURMA. Her secim icin kisa bir aciklama, tahmini sure ve kullaniciya neden
uygun oldugunu Turkce yaz.

Sadece su JSON formatinda dondur:
{"recommendations":[{"ad":"...","kurum":"...","aciklama":"<1-2 cumle>","sure":"<tahmini sure>","gerekce":"<neden uygun, 1-2 cumle>","link":"..."}]}"""
    user = f"KULLANICI PROFILI:\n{profil}\n\nEGITIM LISTESI (JSON):\n{kurs_json}"

    r = a.messages.create(
        model=CLAUDE_MODEL, max_tokens=1600, system=sistem,
        messages=[{"role": "user", "content": user}],
    )
    txt = r.content[0].text.strip()
    mm = re.search(r"\{.*\}", txt, re.DOTALL)
    if mm:
        try:
            d = json.loads(mm.group())
            recs = d.get("recommendations", [])
            if isinstance(recs, list):
                return recs[:6]
        except Exception:
            pass
    return []


# ── HTTP / Guvenlik ─────────────────────────────────────────────────────────────

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
            return self._json(429, {"error": "Cok fazla istek. Lutfen biraz bekleyin."})

        try:
            length = int(self.headers.get("Content-Length", 0))
        except (TypeError, ValueError):
            length = 0
        if length <= 0 or length > MAX_BODY_LEN:
            return self._json(400, {"error": "Gecersiz istek govdesi."})

        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return self._json(400, {"error": "Gecersiz JSON."})

        action = data.get("action")

        try:
            if action == "evaluate":
                soru = (data.get("soru") or "").strip()
                cevap = (data.get("cevap") or "").strip()
                if not cevap:
                    return self._json(400, {"error": "Cevap bos olamaz."})
                if len(soru) > MAX_FIELD_LEN or len(cevap) > MAX_FIELD_LEN:
                    return self._json(400, {"error": "Girdi cok uzun."})
                a, _, _ = _clients()
                return self._json(200, degerlendir(soru, cevap, a))

            elif action == "recommend":
                cevaplar = data.get("cevaplar")
                if not isinstance(cevaplar, list) or not cevaplar:
                    return self._json(400, {"error": "Cevaplar eksik."})
                cevaplar = [
                    {"soru": str(c.get("soru", ""))[:MAX_FIELD_LEN],
                     "cevap": str(c.get("cevap", ""))[:MAX_FIELD_LEN]}
                    for c in cevaplar if isinstance(c, dict)
                ][:20]
                a, o, q = _clients()
                return self._json(200, {"recommendations": oner(cevaplar, a, o, q)})

            else:
                return self._json(400, {"error": "Gecersiz action."})

        except KeyError as e:
            print("[ERROR] eksik env:", str(e))
            return self._json(500, {"error": "Sunucu yapilandirmasi eksik."})
        except Exception as e:
            print("[ERROR]", repr(e))
            return self._json(503, {"error": "AI servisi su an kullanilamiyor, lutfen tekrar deneyin."})

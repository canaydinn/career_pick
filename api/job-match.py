"""
CareerPick — Is ilani uyum analizi
POST /api/job-match

Govde:
  { url?, text?, profile?: { scores: [], answers: [] } }

Donen:
  {
    scrape_ok, scrape_error?,
    job: { title, required_skills, nice_to_have, experience_years, summary },
    fit_score, strong, gaps, items,
    recommendations: [...],
    disclaimer
  }
"""

import os
import re
import json
import time
import ipaddress
import socket
from html.parser import HTMLParser
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from http.server import BaseHTTPRequestHandler

from openai import OpenAI
from anthropic import Anthropic
from qdrant_client import QdrantClient

CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")
EMBEDDING_MODEL = "text-embedding-3-small"
EGITIM_COLLECTION = "careerpick"
MAX_HTML_BYTES = 1_200_000
FETCH_TIMEOUT = 12
MAX_TEXT_CHARS = 12000
RATE_LIMIT_MAX = 20
RATE_LIMIT_WIN = 60
_RATE_BUCKET = {}

DISCLAIMER = (
    "Bu analiz genel metin incelemesine dayanan yaklaşık bir uyum sinyalidir; "
    "kesin işe alım sonucu veya garanti değildir."
)


def _clients():
    a = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    o = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    q = QdrantClient(url=os.environ["QDRANT_URL"], api_key=os.environ["QDRANT_API_KEY"], timeout=60)
    return a, o, q


def _embed(metin, o):
    return o.embeddings.create(model=EMBEDDING_MODEL, input=[metin]).data[0].embedding


def egitim_ara(arama_metni, o, q, limit=8):
    emb = _embed(arama_metni, o)
    res = q.query_points(collection_name=EGITIM_COLLECTION, query=emb,
                         limit=limit, with_payload=True).points
    kurslar = []
    for p in res:
        pl = p.payload or {}
        kurslar.append({
            "ad": pl.get("kurs_egitim_adi") or pl.get("baslik") or "",
            "kurum": pl.get("kurum_adi") or "",
            "kategori": pl.get("kategori") or "",
            "sehir": pl.get("sehir") or "",
            "link": pl.get("sayfa_linki") or pl.get("link") or "",
        })
    return kurslar


def _json_obj_bul(txt):
    if not txt:
        return None
    cleaned = re.sub(r"```(?:json)?\s*", "", txt).replace("```", "").strip()
    mm = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not mm:
        return None
    try:
        return json.loads(mm.group())
    except Exception:
        return None


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self._parts = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript", "svg", "iframe"):
            self._skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg", "iframe") and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        if self._skip:
            return
        t = data.strip()
        if t:
            self._parts.append(t)

    def text(self):
        raw = " ".join(self._parts)
        raw = re.sub(r"\s+", " ", raw).strip()
        return raw


def _is_public_host(hostname):
    if not hostname:
        return False
    host = hostname.lower().strip(".")
    if host in ("localhost", "metadata.google.internal"):
        return False
    try:
        infos = socket.getaddrinfo(host, None)
    except Exception:
        return False
    for info in infos:
        ip_str = info[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
        ):
            return False
    return True


def fetch_url_text(url):
    """URL'den ana metin. Basarisizsa (ok=False, error, text='')."""
    url = (url or "").strip()
    if not url:
        return False, "URL bos", ""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False, "Sadece http/https desteklenir", ""
    if not parsed.netloc or not _is_public_host(parsed.hostname):
        return False, "Bu adres guvenlik nedeniyle engellendi", ""

    try:
        req = Request(
            url,
            headers={
                "User-Agent": "CareerPickBot/1.0 (+https://careerpick.vercel.app; job-text analysis)",
                "Accept": "text/html,application/xhtml+xml",
            },
        )
        with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
            ctype = (resp.headers.get("Content-Type") or "").lower()
            if "html" not in ctype and "text" not in ctype and ctype:
                return False, "Sayfa HTML/metin degil; metni elle yapistir", ""
            raw = resp.read(MAX_HTML_BYTES + 1)
            if len(raw) > MAX_HTML_BYTES:
                raw = raw[:MAX_HTML_BYTES]
        html = raw.decode("utf-8", errors="ignore")
    except Exception as e:
        return False, f"Sayfa cekilemedi ({type(e).__name__}). Metni elle yapistirabilirsin.", ""

    # Login / paywall ipuclari
    low = html.lower()
    if any(x in low for x in ("sign in to continue", "login to view", "giriş yap", "uye ol", "subscribe to read")):
        if len(re.sub(r"<[^>]+>", " ", html)) < 800:
            return False, "Sayfa giris duvari gibi gorunuyor. Metni elle yapistir.", ""

    parser = _TextExtractor()
    try:
        parser.feed(html)
        text = parser.text()
    except Exception:
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"\s+", " ", text).strip()

    if len(text) < 120:
        return False, "Yeterli metin cikarilamadi. Metni elle yapistir.", ""

    return True, "", text[:MAX_TEXT_CHARS]


def parse_job_with_claude(text, a):
    text = (text or "")[:MAX_TEXT_CHARS]
    sistem = """Sen is ilani analiz uzmanisin.
Verilen ilan metninden yapilandirilmis JSON cikar.
Ilan baska dildeyse required_skills ve nice_to_have terimlerini Turkce karsiliklariyla da dusunerek yaz (kisa TR etiket).
Kesin maas/is garantisi uydurma.
Sadece JSON:
{"title":"...","required_skills":["..."],"nice_to_have":["..."],"experience_years":"...","summary":"..."}"""
    r = a.messages.create(
        model=CLAUDE_MODEL, max_tokens=1200, system=sistem,
        messages=[{"role": "user", "content": f"ILAN METNI:\n{text}"}],
    )
    d = _json_obj_bul(r.content[0].text.strip()) or {}
    title = str(d.get("title") or "Is ilani").strip()[:200]
    req = d.get("required_skills") if isinstance(d.get("required_skills"), list) else []
    nice = d.get("nice_to_have") if isinstance(d.get("nice_to_have"), list) else []
    req = [str(x).strip()[:80] for x in req if str(x).strip()][:20]
    nice = [str(x).strip()[:80] for x in nice if str(x).strip()][:12]
    if not req:
        req = ["iletisim", "problem cozme", "ilgili deneyim"]
    return {
        "title": title,
        "required_skills": req,
        "nice_to_have": nice,
        "experience_years": str(d.get("experience_years") or "").strip()[:80],
        "summary": str(d.get("summary") or "").strip()[:500],
    }


def _profile_blob(profile):
    scores = (profile or {}).get("scores") or []
    answers = (profile or {}).get("answers") or []
    score_lines = []
    for s in scores[:20]:
        if not isinstance(s, dict):
            continue
        score_lines.append(
            f"- {s.get('yetkinlik') or s.get('yetkinlik_adi')}: "
            f"{s.get('puan', '?')}/5 ({s.get('seviye', '')})"
        )
    ans_lines = []
    for a in answers[:12]:
        if not isinstance(a, dict):
            continue
        qid = a.get("question_id") or a.get("key") or ""
        if qid in ("kariyer_hedefi", "mevcut_yetenekler", "deneyim_suresi", "hedef_sektor") or True:
            ans_lines.append(f"- {qid}: {(a.get('answer_text') or a.get('cevap') or '')[:200]}")
    return "\n".join(score_lines) or "(skor yok)", "\n".join(ans_lines[:8]) or "(cevap yok)"


def score_fit(job, profile, a):
    """Claude ile madde madde uyum; yuzde + strong/gaps."""
    skills = job.get("required_skills") or []
    score_txt, ans_txt = _profile_blob(profile)
    sistem = """Kullanici profili ile is ilani gereksinimlerini karsilastir.
Her required_skill icin status: karsilandi | kismen | yok
Kesin is garantisi verme; yaklasik sinyal uret.
fit_score 0-100 arasi tamsayi (agirlikli).
Sadece JSON:
{"fit_score":62,"items":[{"skill":"...","status":"karsilandi|kismen|yok","note":"..."}],"strong":["..."],"gaps":["..."]}"""
    user = (
        f"ILAN: {job.get('title')}\n"
        f"OZET: {job.get('summary')}\n"
        f"DENEYIM: {job.get('experience_years')}\n"
        f"ZORUNLU: {json.dumps(skills, ensure_ascii=False)}\n"
        f"TERCIH: {json.dumps(job.get('nice_to_have') or [], ensure_ascii=False)}\n\n"
        f"YETKINLIK SKORLARI:\n{score_txt}\n\n"
        f"PROFIL CEVAPLARI:\n{ans_txt}"
    )
    try:
        r = a.messages.create(
            model=CLAUDE_MODEL, max_tokens=1400, system=sistem,
            messages=[{"role": "user", "content": user}],
        )
        d = _json_obj_bul(r.content[0].text.strip()) or {}
    except Exception as e:
        print("[ERROR] score_fit:", repr(e))
        d = {}

    items = d.get("items") if isinstance(d.get("items"), list) else []
    cleaned = []
    for it in items:
        if not isinstance(it, dict):
            continue
        st = (it.get("status") or "kismen").strip()
        if st not in ("karsilandi", "kismen", "yok"):
            st = "kismen"
        cleaned.append({
            "skill": str(it.get("skill") or "")[:80],
            "status": st,
            "note": str(it.get("note") or "")[:160],
        })
    if not cleaned and skills:
        cleaned = [{"skill": s, "status": "kismen", "note": ""} for s in skills[:8]]

    # Agirlikli skor (Claude yoksa veya tutarsizsa yeniden hesapla)
    weights = {"karsilandi": 1.0, "kismen": 0.5, "yok": 0.0}
    if cleaned:
        total = sum(weights.get(i["status"], 0.5) for i in cleaned)
        fit = round(100 * total / len(cleaned), 1)
    else:
        fit = 40.0
    try:
        claude_fit = float(d.get("fit_score"))
        if 0 <= claude_fit <= 100:
            fit = round((fit + claude_fit) / 2, 1)
    except (TypeError, ValueError):
        pass

    strong = d.get("strong") if isinstance(d.get("strong"), list) else []
    gaps = d.get("gaps") if isinstance(d.get("gaps"), list) else []
    strong = [str(x)[:80] for x in strong if str(x).strip()][:10]
    gaps = [str(x)[:80] for x in gaps if str(x).strip()][:10]
    if not strong:
        strong = [i["skill"] for i in cleaned if i["status"] == "karsilandi"][:8]
    if not gaps:
        gaps = [i["skill"] for i in cleaned if i["status"] in ("yok", "kismen")][:8]

    return {
        "fit_score": fit,
        "items": cleaned,
        "strong": strong,
        "gaps": gaps,
    }


def recommend_for_gaps(gaps, job_title, a, o, q):
    if not gaps:
        gaps = ["iletisim", "liderlik"]
    arama = " ".join(gaps[:5] + [job_title or "", "egitim sertifika"])
    kurslar = egitim_ara(arama, o, q, limit=12)
    if len(kurslar) < 4:
        ekstra = egitim_ara(" ".join(gaps[:3]) + " yoneticilik", o, q, limit=8)
        seen = {(k.get("ad"), k.get("link")) for k in kurslar}
        for k in ekstra:
            key = (k.get("ad"), k.get("link"))
            if key not in seen:
                kurslar.append(k)
                seen.add(key)

    if not kurslar:
        return []

    kurs_json = json.dumps(kurslar[:12], ensure_ascii=False)
    sistem = """CareerPick egitim danismani.
SADECE verilen listeden 4-6 egitim sec. Uydurma.
Her kartta gerekce: hangi ilan boslugunu kapattigini yaz.
Sadece JSON:
{"recommendations":[{"ad":"...","kurum":"...","aciklama":"...","sure":"...","gerekce":"...","link":"..."}]}"""
    user = f"ILAN: {job_title}\nBOSLUKLAR: {', '.join(gaps)}\n\nLISTE:\n{kurs_json}"
    try:
        r = a.messages.create(
            model=CLAUDE_MODEL, max_tokens=1600, system=sistem,
            messages=[{"role": "user", "content": user}],
        )
        d = _json_obj_bul(r.content[0].text.strip()) or {}
        recs = d.get("recommendations") if isinstance(d.get("recommendations"), list) else []
        out = []
        for item in recs[:6]:
            if not isinstance(item, dict):
                continue
            ad = (item.get("ad") or "").strip()
            if not ad:
                continue
            out.append({
                "ad": ad,
                "kurum": (item.get("kurum") or "").strip(),
                "aciklama": (item.get("aciklama") or "").strip(),
                "sure": (item.get("sure") or "").strip(),
                "gerekce": (item.get("gerekce") or f"{job_title} ilanindaki bosluk icin").strip()[:280],
                "link": (item.get("link") or "").strip(),
            })
        if out:
            return out
    except Exception as e:
        print("[ERROR] recommend_for_gaps:", repr(e))

    # Fallback kartlar
    out = []
    for k in kurslar[:5]:
        if not k.get("ad"):
            continue
        out.append({
            "ad": k["ad"],
            "kurum": k.get("kurum") or "",
            "aciklama": "",
            "sure": "",
            "gerekce": f"{job_title or 'Ilan'} gereksinimlerine yakin bulundu.",
            "link": k.get("link") or "",
        })
    return out


def analyze_job(url, text, profile):
    scrape_ok = True
    scrape_error = ""
    body = (text or "").strip()
    used_url = (url or "").strip() or None

    if not body and used_url:
        scrape_ok, scrape_error, body = fetch_url_text(used_url)
    elif not body:
        return {
            "ok": False,
            "error": "URL veya ilan metni gerekli.",
            "scrape_ok": False,
            "disclaimer": DISCLAIMER,
        }

    if not body:
        return {
            "ok": False,
            "error": scrape_error or "Metin alinamadi.",
            "scrape_ok": False,
            "scrape_error": scrape_error,
            "disclaimer": DISCLAIMER,
            "need_paste": True,
        }

    a, o, q = _clients()
    job = parse_job_with_claude(body, a)
    fit = score_fit(job, profile or {}, a)
    recs = recommend_for_gaps(fit.get("gaps") or [], job.get("title"), a, o, q)

    return {
        "ok": True,
        "scrape_ok": scrape_ok if used_url else True,
        "scrape_error": scrape_error or None,
        "need_paste": False,
        "job_url": used_url,
        "job": job,
        "fit_score": fit["fit_score"],
        "strong": fit["strong"],
        "gaps": fit["gaps"],
        "items": fit["items"],
        "recommendations": recs,
        "disclaimer": DISCLAIMER,
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
            return self._json(429, {"error": "Cok fazla istek. Lutfen biraz bekleyin."})

        try:
            length = int(self.headers.get("Content-Length", 0))
        except (TypeError, ValueError):
            length = 0
        if length <= 0 or length > 400_000:
            return self._json(400, {"error": "Gecersiz istek govdesi."})

        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return self._json(400, {"error": "Gecersiz JSON."})

        url = str(data.get("url") or "").strip()[:2000]
        text = str(data.get("text") or "").strip()[:MAX_TEXT_CHARS]
        profile = data.get("profile") if isinstance(data.get("profile"), dict) else {}

        try:
            result = analyze_job(url, text, profile)
            status = 200 if result.get("ok") else 422
            return self._json(status, result)
        except KeyError as e:
            print("[ERROR] eksik env:", str(e))
            return self._json(500, {"error": "Sunucu yapilandirmasi eksik."})
        except Exception as e:
            print("[ERROR] job-match:", repr(e))
            return self._json(503, {
                "ok": False,
                "error": "Analiz su an kullanilamiyor. Metni yapistirip tekrar dene.",
                "need_paste": True,
                "disclaimer": DISCLAIMER,
            })

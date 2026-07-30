"""
CareerPick — CV vs hedef rol bosluk analizi
POST /api/cv-gap

Govde:
  {
    cv_text?,
    cv_base64?,      # opsiyonel PDF (kucuk)
    cv_filename?,
    target_role?,
    profile?: { scores: [], answers: [] }
  }

Donen:
  {
    ok, target_role,
    cv: { summary, skills, experience_years, highlights },
    fit_score, strong, gaps, items,
    recommendations: [...],
    disclaimer
  }
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
import time
from http.server import BaseHTTPRequestHandler

from anthropic import Anthropic
from openai import OpenAI
from qdrant_client import QdrantClient

CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")
EMBEDDING_MODEL = "text-embedding-3-small"
EGITIM_COLLECTION = "careerpick"
MAX_TEXT_CHARS = 16000
MAX_BODY = 900_000
MAX_PDF_BYTES = 1_200_000
RATE_LIMIT_MAX = 12
RATE_LIMIT_WIN = 60
_RATE_BUCKET = {}

DISCLAIMER = (
    "Bu analiz CV metni ile hedef role dayanan yaklaşık bir boşluk sinyalidir; "
    "kesin işe alım sonucu veya garanti değildir."
)


def _clients():
    a = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    o = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    q = QdrantClient(url=os.environ["QDRANT_URL"], api_key=os.environ["QDRANT_API_KEY"], timeout=60)
    return a, o, q


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


def _rate_ok(ip):
    now = time.time()
    bucket = _RATE_BUCKET.setdefault(ip, [])
    _RATE_BUCKET[ip] = [t for t in bucket if now - t < RATE_LIMIT_WIN]
    if len(_RATE_BUCKET[ip]) >= RATE_LIMIT_MAX:
        return False
    _RATE_BUCKET[ip].append(now)
    return True


def _embed(metin, o):
    return o.embeddings.create(model=EMBEDDING_MODEL, input=[metin]).data[0].embedding


def egitim_ara(arama_metni, o, q, limit=8):
    emb = _embed(arama_metni, o)
    res = q.query_points(
        collection_name=EGITIM_COLLECTION,
        query=emb,
        limit=limit,
        with_payload=True,
    ).points
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


def extract_pdf_text(b64: str) -> str:
    raw = base64.b64decode(b64, validate=False)
    if len(raw) > MAX_PDF_BYTES:
        raise ValueError("PDF çok büyük (max ~1.2MB).")
    try:
        from pypdf import PdfReader
    except ImportError as e:
        raise ValueError("PDF desteği kurulu değil; metni yapıştır.") from e
    reader = PdfReader(io.BytesIO(raw))
    parts = []
    for page in reader.pages[:40]:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            continue
    text = "\n".join(parts).strip()
    if len(text) < 40:
        raise ValueError("PDF’den metin okunamadı; metni yapıştır.")
    return text


def parse_cv(text, a):
    sistem = """Sen CV / ozgecmis analiz uzmanisin.
Verilen metinden yapilandirilmis JSON cikar.
Becerileri kisa Turkce etiketlerle yaz.
Kesin maas veya ise alim sonucu uydurma.
Sadece JSON:
{"summary":"...","skills":["..."],"experience_years":"...","highlights":["..."]}"""
    try:
        r = a.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1200,
            system=sistem,
            messages=[{"role": "user", "content": f"CV METNI:\n{text}"}],
        )
        raw = ""
        if r.content and len(r.content) > 0:
            block = r.content[0]
            raw = (getattr(block, "text", None) or str(block) or "").strip()
        d = _json_obj_bul(raw) or {}
    except Exception as e:
        print("[ERROR] parse_cv:", repr(e))
        d = {}

    skills = d.get("skills") if isinstance(d.get("skills"), list) else []
    skills = [str(x).strip()[:80] for x in skills if str(x).strip()][:24]
    highlights = d.get("highlights") if isinstance(d.get("highlights"), list) else []
    highlights = [str(x).strip()[:160] for x in highlights if str(x).strip()][:8]
    summary = str(d.get("summary") or "").strip()[:600] or text[:400]
    years = str(d.get("experience_years") or "").strip()[:80]
    if not skills:
        # basit fallback: satirlardan token
        tokens = re.findall(r"[A-Za-zÇĞİÖŞÜçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü0-9+.#-]{2,}", text)
        seen = set()
        for t in tokens:
            k = t.lower()
            if k in seen:
                continue
            seen.add(k)
            skills.append(t[:80])
            if len(skills) >= 10:
                break
    return {
        "summary": summary,
        "skills": skills,
        "experience_years": years,
        "highlights": highlights,
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
        ans_lines.append(f"- {qid}: {(a.get('answer_text') or a.get('cevap') or '')[:200]}")
    return "\n".join(score_lines) or "(skor yok)", "\n".join(ans_lines[:8]) or "(cevap yok)"


def score_vs_role(cv, target_role, profile, a):
    score_txt, ans_txt = _profile_blob(profile)
    sistem = """Kullanicinin CV ozeti ile hedef rolu karsilastir.
Hedef rol icin kritik yetkinlik/beceri maddeleri uret ve her madde icin status ver:
karsilandi | kismen | yok
Kesin is garantisi verme; yaklasik sinyal uret.
fit_score 0-100 arasi.
Sadece JSON:
{"fit_score":62,"items":[{"skill":"...","status":"karsilandi|kismen|yok","note":"..."}],"strong":["..."],"gaps":["..."]}"""
    user = (
        f"HEDEF ROL: {target_role}\n\n"
        f"CV OZET: {cv.get('summary')}\n"
        f"DENEYIM: {cv.get('experience_years')}\n"
        f"CV BECERILER: {json.dumps(cv.get('skills') or [], ensure_ascii=False)}\n"
        f"ONE CIKANLAR: {json.dumps(cv.get('highlights') or [], ensure_ascii=False)}\n\n"
        f"YETKINLIK SKORLARI (sohbet):\n{score_txt}\n\n"
        f"PROFIL CEVAPLARI:\n{ans_txt}"
    )
    try:
        r = a.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1400,
            system=sistem,
            messages=[{"role": "user", "content": user}],
        )
        d = _json_obj_bul(r.content[0].text.strip()) or {}
    except Exception as e:
        print("[ERROR] score_vs_role:", repr(e))
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
    if not cleaned:
        for s in (cv.get("skills") or [])[:8]:
            cleaned.append({"skill": s, "status": "kismen", "note": ""})

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

    return {"fit_score": fit, "items": cleaned, "strong": strong, "gaps": gaps}


def recommend_for_gaps(gaps, target_role, a, o, q):
    if not gaps:
        gaps = ["iletisim", "problem cozme"]
    arama = " ".join(gaps[:5] + [target_role or "", "egitim sertifika"])
    kurslar = []
    try:
        kurslar = egitim_ara(arama, o, q, limit=12)
    except Exception as e:
        print("[ERROR] egitim_ara cv-gap:", repr(e))
        kurslar = []

    if not kurslar:
        return [{
            "ad": f"{g} geliştirme eğitimi"[:120],
            "kurum": "",
            "aciklama": "Hedef rol boşluğuna yönelik genel öneri (katalog araması geçici olarak kullanılamadı).",
            "sure": "",
            "gerekce": f"CV boşluğu: {g}",
            "link": "",
            "is_placeholder": True,
        } for g in gaps[:4]]

    kurs_json = json.dumps(kurslar[:12], ensure_ascii=False)
    sistem = """CareerPick egitim danismani.
SADECE verilen listeden 4-6 egitim sec. Uydurma.
Her kartta gerekce: hangi CV/hedef-rol boslugunu kapattigini yaz.
Sadece JSON:
{"recommendations":[{"ad":"...","kurum":"...","aciklama":"...","sure":"...","gerekce":"...","link":"..."}]}"""
    user = f"HEDEF ROL: {target_role}\nBOSLUKLAR: {', '.join(gaps)}\n\nLISTE:\n{kurs_json}"
    try:
        r = a.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1600,
            system=sistem,
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
                "gerekce": (item.get("gerekce") or f"{target_role} hedefi icin").strip()[:280],
                "link": (item.get("link") or "").strip(),
            })
        if out:
            return out
    except Exception as e:
        print("[ERROR] recommend cv-gap:", repr(e))

    out = []
    for k in kurslar[:5]:
        if not k.get("ad"):
            continue
        out.append({
            "ad": k["ad"],
            "kurum": k.get("kurum") or "",
            "aciklama": "",
            "sure": "",
            "gerekce": f"{target_role or 'Hedef rol'} boşluklarına yakın bulundu.",
            "link": k.get("link") or "",
        })
    return out


def analyze_cv_gap(cv_text, target_role, profile):
    body = (cv_text or "").strip()
    role = (target_role or "").strip()
    if not body:
        return {"ok": False, "error": "CV metni gerekli.", "disclaimer": DISCLAIMER}
    if len(role) < 2:
        return {"ok": False, "error": "Hedef rol gerekli.", "disclaimer": DISCLAIMER}
    if len(body) > MAX_TEXT_CHARS:
        body = body[:MAX_TEXT_CHARS]

    try:
        a, o, q = _clients()
    except KeyError as e:
        print("[ERROR] cv-gap env:", str(e))
        return {
            "ok": False,
            "error": "Analiz servisi yapılandırması eksik.",
            "disclaimer": DISCLAIMER,
        }

    try:
        cv = parse_cv(body, a)
    except Exception as e:
        print("[ERROR] parse_cv analyze:", repr(e))
        cv = {
            "summary": body[:400],
            "skills": [],
            "experience_years": "",
            "highlights": [],
        }

    try:
        fit = score_vs_role(cv, role, profile or {}, a)
    except Exception as e:
        print("[ERROR] score analyze:", repr(e))
        fit = {
            "fit_score": 45.0,
            "items": [],
            "strong": [],
            "gaps": (cv.get("skills") or [])[:4] or ["iletisim"],
        }

    try:
        recs = recommend_for_gaps(fit.get("gaps") or [], role, a, o, q)
    except Exception as e:
        print("[ERROR] recs analyze:", repr(e))
        recs = []

    return {
        "ok": True,
        "target_role": role,
        "cv": cv,
        "fit_score": fit["fit_score"],
        "strong": fit["strong"],
        "gaps": fit["gaps"],
        "items": fit["items"],
        "recommendations": recs,
        "disclaimer": DISCLAIMER,
    }


class handler(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        try:
            from plus_gate import require_plus
        except ImportError:
            from api.plus_gate import require_plus

        ok_plus, status_plus, gate = require_plus(self.headers)
        if not ok_plus:
            if "disclaimer" not in gate:
                gate = dict(gate)
                gate["disclaimer"] = DISCLAIMER
            return self._json(status_plus, gate)

        ip = self.headers.get("x-forwarded-for") or self.client_address[0] or "unknown"
        ip = str(ip).split(",")[0].strip()
        if not _rate_ok(ip):
            return self._json(429, {"ok": False, "error": "Cok fazla istek. Biraz sonra dene.", "disclaimer": DISCLAIMER})

        length = int(self.headers.get("content-length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self._json(400, {"ok": False, "error": "Gecersiz istek boyutu.", "disclaimer": DISCLAIMER})

        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return self._json(400, {"ok": False, "error": "JSON okunamadi.", "disclaimer": DISCLAIMER})

        cv_text = str(data.get("cv_text") or "").strip()
        b64 = str(data.get("cv_base64") or "").strip()
        filename = str(data.get("cv_filename") or "").lower()
        if not cv_text and b64:
            try:
                is_pdf = filename.endswith(".pdf") or b64.startswith("JVBERi0")
                if is_pdf:
                    cv_text = extract_pdf_text(b64)
                else:
                    raw = base64.b64decode(b64, validate=False)
                    if len(raw) > MAX_PDF_BYTES:
                        return self._json(400, {
                            "ok": False,
                            "error": "Dosya çok büyük.",
                            "disclaimer": DISCLAIMER,
                        })
                    cv_text = raw.decode("utf-8", errors="ignore").strip()
                    if len(cv_text) < 40:
                        # belki PDF ama uzanti yanlis
                        cv_text = extract_pdf_text(b64)
            except Exception as e:
                return self._json(422, {
                    "ok": False,
                    "error": str(e) or "Dosya okunamadi; metni yapistir.",
                    "disclaimer": DISCLAIMER,
                })

        target_role = str(data.get("target_role") or "").strip()
        profile = data.get("profile") if isinstance(data.get("profile"), dict) else {}

        # Hedef rol profil cevaplarindan dusebilir
        if len(target_role) < 2:
            for ans in (profile.get("answers") or []):
                if isinstance(ans, dict) and ans.get("question_id") == "kariyer_hedefi":
                    target_role = str(ans.get("answer_text") or "").strip()
                    if target_role:
                        break

        result = analyze_cv_gap(cv_text, target_role, profile)
        code = 200 if result.get("ok") else 422
        return self._json(code, result)

    def log_message(self, fmt, *args):
        return

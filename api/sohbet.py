"""
CareerPick — Kariyer Sohbeti backend (Vercel Serverless Function)
=================================================================
POST /api/sohbet

Islemler (action):

1) evaluate  — yanit yeterliligi (max 1 takip; kisa ama net cevaplar kabul)
2) scenarios — profil yanitlarina gore RAG'den meta_senaryo ceker
3) recommend — profil + senaryo puanlariyla egitim onerir
4) roadmap   — hedef + yetkinlik + egitimlerden 3-5 adimlik yol haritasi
5) compare_summary — onceki vs simdi yetkinlik farkindan tek cumle (opsiyonel)
6) micro_tasks — zayif yetkinlikler icin 2-4 haftalik kisa pratik
7) personalize_sector_note — sektor notuna opsiyonel tek cumle (zorunlu degil)
8) checkin_reflect — haftalik check-in icin tek cumle yansima (opsiyonel)

Ortam: OPENAI_API_KEY, ANTHROPIC_API_KEY, QDRANT_URL, QDRANT_API_KEY,
(ops.) CLAUDE_MODEL, ALLOWED_ORIGINS
"""

import os
import json
import re
import time
from http.server import BaseHTTPRequestHandler

from openai import OpenAI
from anthropic import Anthropic
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue

EGITIM_COLLECTION  = "edupick_egitimler"
CAREER_COLLECTION  = "careerpick"
EMBEDDING_MODEL    = "text-embedding-3-large"
CLAUDE_MODEL       = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")
EKSIK_ESIGI        = 3.0
SENARYO_ADETI      = 5
MAX_FOLLOWUP_TRIES = 1

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


def _embed(metin, o):
    return o.embeddings.create(model=EMBEDDING_MODEL, input=[metin]).data[0].embedding


# ── Evaluate ───────────────────────────────────────────────────────────────────

def degerlendir(soru, cevap, a, tip="profile", yetkinlik="", attempt=0):
    """attempt = bu soruda daha once kac yetersiz deneme oldu.
    Bir takipten sonra tekrar reddetme — akisi kilitleme."""
    try:
        attempt = int(attempt or 0)
    except (TypeError, ValueError):
        attempt = 0
    if attempt >= MAX_FOLLOWUP_TRIES:
        return {"sufficient": True, "followup": ""}

    cevap_temiz = (cevap or "").strip()
    if not cevap_temiz:
        return {"sufficient": False, "followup": "Kisa da olsa bir yanit yazar misin?"}

    if tip == "scenario":
        prompt = f"""Yetkinlik senaryosu yanitini degerlendir.

SENARYO: {soru}
YETKINLIK: {yetkinlik or "genel"}
YANIT: {cevap_temiz}

Kabul et (sufficient=true) eger kullanici ne yapacagina dair EN AZ bir eylem, yaklasim veya gerekce soyluyorsa.
Sadece "bilmiyorum", "evet", "hayir", emoji veya tamamen alakasiz metin yetersizdir.

Sadece JSON:
{{"sufficient": true veya false, "followup": "<yetersizse tek kisa takip sorusu>"}}"""
    else:
        prompt = f"""Kariyer formu yanitini degerlendir. COK TOLERANSLI ol.

SORU: {soru}
YANIT: {cevap_temiz}

KABUL ET (sufficient=true) — asagidakiler YETERLIDIR:
- Sektor / hedef / calisma sekli soylenmisse (tek kelime bile: "saglik", "uzaktan")
- Beceri veya egitim belirtilmisse ("YBS mezunu", "Python, Excel")
- Deneyim suresi netse: "yeni basliyorum", "yok", "hic yok", "2 yil", "staj yaptim"
- Kullanici bilerek "yok / hic deneyimim yok / yeni basliyorum" diyorsa TEKRAR SORMA

SADECE su durumlarda yetersiz say:
- Bos / anlamsiz / tamamen alakasiz
- Soruyla hic ilgisiz tek hece (orn. "asdf", "...")

Ayni soruyu farkli kelimelerle tekrar etme. Takip sorusu gerekiyorsa onceki cevabi kabul edip SADECE eksik bir noktayi sor.

Sadece JSON:
{{"sufficient": true veya false, "followup": "<yetersizse tek kisa takip>"}}"""

    r = a.messages.create(
        model=CLAUDE_MODEL, max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    txt = r.content[0].text.strip()
    mm = re.search(r"\{.*\}", txt, re.DOTALL)
    if mm:
        try:
            d = json.loads(mm.group())
            return {
                "sufficient": bool(d.get("sufficient", True)),
                "followup": (d.get("followup") or "").strip(),
            }
        except Exception:
            pass
    return {"sufficient": True, "followup": ""}


# ── RAG senaryolar ─────────────────────────────────────────────────────────────

def _yetkinlik_nolarini_cikar(yetkinlik_kodlari):
    nolar = set()
    for kod in yetkinlik_kodlari or []:
        m = re.match(r"(\d+)-", str(kod))
        if m:
            nolar.add(int(m.group(1)))
    return sorted(nolar)


def _meslek_profili_getir(arama, o, q):
    if not arama.strip():
        return None
    res = q.query_points(
        collection_name=CAREER_COLLECTION,
        query=_embed(arama, o),
        query_filter=Filter(must=[
            FieldCondition(key="chunk_type", match=MatchValue(value="meslek_profili"))
        ]),
        limit=1,
        with_payload=True,
    )
    if not res.points:
        return None
    pl = res.points[0].payload or {}
    return {
        "meslek_adi": pl.get("meslek_adi", ""),
        "yetkinlik_kodlari": pl.get("yetkinlik_kodlari", []),
    }


def _meta_senaryo_getir(yetkinlik_nolari, arama_baglam, o, q, adet=SENARYO_ADETI):
    if yetkinlik_nolari:
        sorgu = f"yetkinlik degerlendirme {' '.join(str(n) for n in yetkinlik_nolari[:8])} {arama_baglam}"
    else:
        sorgu = arama_baglam or "is yeri yetkinlik senaryosu"
    res = q.query_points(
        collection_name=CAREER_COLLECTION,
        query=_embed(sorgu, o),
        query_filter=Filter(must=[
            FieldCondition(key="chunk_type", match=MatchValue(value="meta_senaryo"))
        ]),
        limit=adet + 8,
        with_payload=True,
    )
    gorulen = set()
    out = []
    for p in res.points:
        pl = p.payload or {}
        sno = pl.get("senaryo_no")
        if sno in gorulen:
            continue
        if not (pl.get("senaryo_metni") or "").strip():
            continue
        gorulen.add(sno)
        out.append(pl)
        if len(out) >= adet:
            break
    return out


def _profil_baglami(cevaplar):
    parcalar = []
    for c in cevaplar or []:
        key = (c.get("key") or "").strip()
        cevap = (c.get("cevap") or "").strip()
        if not cevap:
            continue
        if key in ("hedef_sektor", "kariyer_hedefi", "mevcut_yetenekler", "deneyim_suresi"):
            parcalar.append(cevap)
        elif (c.get("type") or "profile") != "scenario":
            parcalar.append(cevap)
    return " ".join(parcalar).strip()


def senaryolari_hazirla(cevaplar, o, q):
    """Profil yanitlarina gore RAG'den senaryo sorulari uretir."""
    baglam = _profil_baglami(cevaplar)
    profil = _meslek_profili_getir(baglam, o, q)
    nolar = _yetkinlik_nolarini_cikar(profil.get("yetkinlik_kodlari", [])) if profil else []
    raw = _meta_senaryo_getir(nolar, baglam, o, q, adet=SENARYO_ADETI)

    sorular = []
    for i, s in enumerate(raw):
        metin = (s.get("senaryo_metni") or "").strip()
        yetkinlik = (s.get("ana_yetkinlik_adi") or "Yetkinlik").strip()
        sno = s.get("senaryo_no", i)
        sorular.append({
            "key": f"senaryo_{sno}",
            "type": "scenario",
            "yetkinlik": yetkinlik,
            "q": f"{metin}\n\nBu durumda ilk eylemin ne olurdu ve neden?",
            "placeholder": "Ilk eylemini ve gerekceni yaz…",
            "senaryo_no": sno,
            "ana_yetkinlik_no": s.get("ana_yetkinlik_no"),
            "ana_yetkinlik_rubrik": (s.get("ana_yetkinlik_rubrik") or "")[:500],
            "ikincil_yetkinlik_1_adi": s.get("ikincil_yetkinlik_1_adi") or "",
            "ikincil_yetkinlik_1_rubrik": (s.get("ikincil_yetkinlik_1_rubrik") or "")[:300],
            "ikincil_yetkinlik_2_adi": s.get("ikincil_yetkinlik_2_adi") or "",
            "ikincil_yetkinlik_2_rubrik": (s.get("ikincil_yetkinlik_2_rubrik") or "")[:300],
        })
    return {
        "questions": sorular,
        "meslek": (profil or {}).get("meslek_adi", ""),
    }


# ── Egitim + puanlama ──────────────────────────────────────────────────────────

def egitim_ara(arama_metni, o, q, limit=8):
    emb = _embed(arama_metni, o)
    res = q.query_points(collection_name=EGITIM_COLLECTION, query=emb,
                         limit=limit, with_payload=True).points
    kurslar = []
    for p in res:
        pl = p.payload or {}
        score = getattr(p, "score", None)
        try:
            score = float(score) if score is not None else None
        except (TypeError, ValueError):
            score = None
        kurslar.append({
            "ad":       pl.get("kurs_egitim_adi") or pl.get("baslik") or "",
            "kurum":    pl.get("kurum_adi") or "",
            "kategori": pl.get("kategori") or "",
            "sehir":    pl.get("sehir") or "",
            "link":     pl.get("sayfa_linki") or pl.get("link") or "",
            "score":    score,
        })
    return kurslar


_SECTOR_ALIASES = {
    "turizm": ["turizm", "otel", "hotel", "hospitality", "konaklama", "resort", "misafir"],
    "yazilim": ["yazilim", "software", "developer", "programlama", "bilisim", "teknoloji", "kodlama", "devops", "frontend", "backend"],
    "insaat": ["insaat", "construction", "santiye", "muteahhit", "yapi"],
    "finans": ["finans", "muhasebe", "banka", "finance", "accounting", "maliye", "yatirim"],
    "saglik": ["saglik", "health", "hastane", "hemsire", "medikal", "klinik", "eczane"],
}


def _normalize_sector_text(text):
    t = (text or "").strip().lower()
    for a, b in (("ı", "i"), ("İ", "i"), ("ğ", "g"), ("ü", "u"), ("ş", "s"), ("ö", "o"), ("ç", "c")):
        t = t.replace(a, b)
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def match_sector_key(answer_text):
    t = _normalize_sector_text(answer_text)
    if not t:
        return "genel"
    for key in ("turizm", "yazilim", "insaat", "finans", "saglik"):
        if key in t:
            return key
        for alias in _SECTOR_ALIASES.get(key, []):
            if alias in t:
                return key
    return "genel"


def _log_recommendation_event(row):
    """Best-effort; oneri yanitini engellemez."""
    base = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not base or not key:
        return
    try:
        import urllib.request
        req = urllib.request.Request(
            base + "/rest/v1/recommendation_events",
            data=json.dumps(row, ensure_ascii=False).encode("utf-8"),
            headers={
                "apikey": key,
                "Authorization": "Bearer " + key,
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            resp.read()
    except Exception as e:
        print("[WARN] recommendation_event:", repr(e))


THIN_REC_MAX = 2
LOW_SCORE_THRESHOLD = 0.35


def yetkinlikleri_puanla(senaryolar, a):
    if not senaryolar:
        return []

    bloklar = []
    for i, s in enumerate(senaryolar, 1):
        rubrik = (s.get("ana_yetkinlik_rubrik") or "").strip()
        blok = (
            f"{i}) YETKINLIK: {s.get('yetkinlik') or 'Genel'}\n"
            f"   SENARYO: {(s.get('soru') or '')[:700]}\n"
            f"   CEVAP: {(s.get('cevap') or '')[:900]}"
        )
        if rubrik:
            blok += f"\n   RUBRIK: {rubrik[:400]}"
        bloklar.append(blok)
    paket = "\n\n".join(bloklar)

    prompt = f"""Davranissal yetkinlik degerlendirme uzmanisin.
Senaryo yanitlarini ilgili yetkinlik icin 1-5 puanla. Rubrik varsa ona uy.

Olcek: 1 cok zayif … 5 guclu. Her biri icin max 1 cumle yorum.

SENARYOLAR:
{paket}

Sadece JSON:
{{"yetkinlikler":[{{"yetkinlik":"...","puan":<1-5>,"yorum":"..."}}]}}"""

    r = a.messages.create(
        model=CLAUDE_MODEL, max_tokens=900,
        messages=[{"role": "user", "content": prompt}],
    )
    txt = r.content[0].text.strip()
    mm = re.search(r"\{.*\}", txt, re.DOTALL)
    if not mm:
        return _varsayilan_puanlar(senaryolar)
    try:
        d = json.loads(mm.group())
        items = d.get("yetkinlikler", [])
        if not isinstance(items, list) or not items:
            return _varsayilan_puanlar(senaryolar)
        sonuc = []
        for i, s in enumerate(senaryolar):
            raw = items[i] if i < len(items) else {}
            try:
                puan = float(raw.get("puan", 3))
            except (TypeError, ValueError):
                puan = 3.0
            puan = max(1.0, min(5.0, puan))
            yetkinlik = (raw.get("yetkinlik") or s.get("yetkinlik") or "Genel").strip()
            seviye = "guclu" if puan >= EKSIK_ESIGI else "gelistirilmeli"
            sonuc.append({
                "yetkinlik": yetkinlik,
                "puan": round(puan, 1),
                "seviye": seviye,
                "yorum": (raw.get("yorum") or "").strip()[:220],
            })
        return sonuc
    except Exception:
        return _varsayilan_puanlar(senaryolar)


def _varsayilan_puanlar(senaryolar):
    return [{
        "yetkinlik": (s.get("yetkinlik") or "Genel").strip(),
        "puan": 3.0,
        "seviye": "guclu",
        "yorum": "",
    } for s in senaryolar]


def _yetkinlik_arama_terimi(ad):
    """'2. Vizyoner Liderlik (X)' -> 'Vizyoner Liderlik' — embedding'i bozmasin."""
    t = (ad or "").strip()
    t = re.sub(r"^\d+\.\s*", "", t)
    t = re.sub(r"\(.*?\)", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _cevap_by_key(cevaplar, key):
    for c in cevaplar or []:
        if (c.get("key") or "") == key:
            return (c.get("cevap") or "").strip()
    return ""


def _kurslari_kartlara(kurslar, gerekce_varsayilan, limit=5):
    kartlar = []
    for k in kurslar:
        ad = (k.get("ad") or "").strip()
        if not ad:
            continue
        kartlar.append({
            "ad": ad,
            "kurum": k.get("kurum") or "",
            "aciklama": (k.get("kategori") or "Profiline uygun egitim adayi.").strip(),
            "sure": "",
            "gerekce": gerekce_varsayilan,
            "link": k.get("link") or "",
        })
        if len(kartlar) >= limit:
            break
    return kartlar


def _json_obj_bul(txt):
    """Claude yanitindan ilk JSON nesnesini cek (markdown fence dahil)."""
    if not txt:
        return None
    cleaned = re.sub(r"```(?:json)?\s*", "", txt).replace("```", "").strip()
    mm = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not mm:
        return None
    try:
        return json.loads(mm.group())
    except Exception:
        # Bazen trailing virgul / kirpik JSON; recommendations dizisini elle al
        m2 = re.search(r'"recommendations"\s*:\s*(\[[\s\S]*?\])\s*[,}]', cleaned)
        if m2:
            try:
                return {"recommendations": json.loads(m2.group(1))}
            except Exception:
                return None
    return None


def oner(cevaplar, a, o, q, session_id=None, user_id=None):
    profil = [c for c in cevaplar if (c.get("type") or "profile") != "scenario"]
    senaryolar = [c for c in cevaplar if (c.get("type") or "") == "scenario"]

    yetkinlikler = yetkinlikleri_puanla(senaryolar, a) if senaryolar else []
    eksikler = [y["yetkinlik"] for y in yetkinlikler if y.get("seviye") == "gelistirilmeli"]
    if not eksikler and yetkinlikler:
        sirali = sorted(yetkinlikler, key=lambda y: y.get("puan", 5))
        eksikler = [y["yetkinlik"] for y in sirali[:2]]

    sektor = _cevap_by_key(cevaplar, "hedef_sektor")
    hedef = _cevap_by_key(cevaplar, "kariyer_hedefi")
    beceriler = _cevap_by_key(cevaplar, "mevcut_yetenekler")
    eksik_terimler = [_yetkinlik_arama_terimi(x) for x in eksikler[:3]]
    eksik_terimler = [t for t in eksik_terimler if t]
    sektor_key = match_sector_key(sektor)

    # Kariyer hedefi once; uzun yetkinlik unvanlari aramayi bozmasin
    arama = " ".join(
        p for p in [hedef, sektor, beceriler, " ".join(eksik_terimler[:2]), "egitim sertifika"]
        if p
    ).strip() or "kariyer egitimi"

    kurslar = []
    try:
        kurslar = egitim_ara(arama, o, q, limit=12)
        # Zayif eslesmede hedef odakli ikinci arama
        if len(kurslar) < 4 and (hedef or sektor):
            ekstra = egitim_ara(f"{hedef} {sektor} yoneticilik liderlik isletme", o, q, limit=12)
            gorulen = {(k.get("ad"), k.get("link")) for k in kurslar}
            for k in ekstra:
                key = (k.get("ad"), k.get("link"))
                if key not in gorulen:
                    kurslar.append(k)
                    gorulen.add(key)
                if len(kurslar) >= 12:
                    break
    except Exception as e:
        print("[ERROR] oner egitim_ara:", repr(e))
        kurslar = []

    def _emit(recs, outcome_hint=None):
        usable = [k for k in kurslar if (k.get("ad") or "").strip()]
        hit = len(usable)
        scores = [k.get("score") for k in usable if k.get("score") is not None]
        top = max(scores) if scores else None
        n = len(recs or [])
        if outcome_hint:
            outcome = outcome_hint
        elif hit == 0 or n == 0:
            outcome = "empty_qdrant"
        elif n <= THIN_REC_MAX:
            outcome = "thin"
        elif top is not None and top < LOW_SCORE_THRESHOLD:
            outcome = "low_score"
        else:
            outcome = "ok"
        sid = None
        if session_id:
            try:
                sid = str(session_id).strip() or None
            except Exception:
                sid = None
        uid = None
        if user_id:
            try:
                uid = str(user_id).strip() or None
            except Exception:
                uid = None
        _log_recommendation_event({
            "source": "sohbet",
            "user_id": uid,
            "session_id": sid,
            "sektor_raw": (sektor or "")[:200] or None,
            "hedef_raw": (hedef or "")[:200] or None,
            "sektor_key": sektor_key,
            "search_query": (arama or "")[:500] or None,
            "qdrant_hit_count": hit,
            "top_score": top,
            "final_rec_count": n,
            "outcome": outcome,
            "meta": {
                "thin_max": THIN_REC_MAX,
                "low_score_threshold": LOW_SCORE_THRESHOLD,
            },
        })
        return recs, yetkinlikler

    if not kurslar:
        return _emit([], "empty_qdrant")

    fallback = _kurslari_kartlara(
        kurslar,
        "Hedef kariyerin ve gelisim alanlarina yakin bulundu.",
        limit=5,
    )

    # Claude'a sadece profil ozeti (uzun senaryo metinleri token/JSON'u sisirir)
    profil_satirlari = "\n".join(
        f"- {c.get('soru','')}: {c.get('cevap','')}" for c in profil
    )
    if yetkinlikler:
        y_satir = "\n".join(
            f"- {_yetkinlik_arama_terimi(y['yetkinlik']) or y['yetkinlik']}: "
            f"{y['puan']}/5 ({y['seviye']})"
            for y in yetkinlikler
        )
        profil_satirlari += f"\n\nYETKINLIK PUANLARI:\n{y_satir}"
        if eksik_terimler:
            profil_satirlari += f"\n\nONCELIKLI GELISIM ALANLARI: {', '.join(eksik_terimler)}"

    # Skor alanini Claude listesine gonderme (gereksiz gurultu)
    kurs_for_claude = [
        {k: v for k, v in item.items() if k != "score"}
        for item in kurslar
    ]
    kurs_json = json.dumps(kurs_for_claude, ensure_ascii=False)
    sistem = """Sen CareerPick platformunun kariyer danismanisin.
Gorevin: SADECE verilen egitim listesinden en uygun 4-6 egitimi secmek.
Listede olmayan egitim UYDURMA. Bos liste DONME — birebir turizm/otel egitimi
olmasa bile yoneticilik, liderlik, isletme, iletisim gibi en yakinlarini sec.

Oncelik: 1) hedef kariyer / sektor  2) eksik yetkinlikleri destekleyen egitimler.

Sadece su JSON'u dondur (baska metin yok):
{"recommendations":[{"ad":"...","kurum":"...","aciklama":"<1-2 cumle>","sure":"<tahmini sure veya bos>","gerekce":"<neden uygun>","link":"..."}]}"""
    user = f"KULLANICI PROFILI:\n{profil_satirlari}\n\nEGITIM LISTESI (JSON):\n{kurs_json}"

    try:
        r = a.messages.create(
            model=CLAUDE_MODEL, max_tokens=2000, system=sistem,
            messages=[{"role": "user", "content": user}],
        )
        txt = r.content[0].text.strip()
        d = _json_obj_bul(txt)
        if d:
            recs = d.get("recommendations", [])
            if isinstance(recs, list) and recs:
                temiz = []
                for item in recs[:6]:
                    if not isinstance(item, dict):
                        continue
                    ad = (item.get("ad") or "").strip()
                    if not ad:
                        continue
                    temiz.append({
                        "ad": ad,
                        "kurum": (item.get("kurum") or "").strip(),
                        "aciklama": (item.get("aciklama") or "").strip(),
                        "sure": (item.get("sure") or "").strip(),
                        "gerekce": (item.get("gerekce") or "").strip(),
                        "link": (item.get("link") or "").strip(),
                    })
                if temiz:
                    return _emit(temiz)
    except Exception as e:
        print("[ERROR] oner claude:", repr(e))

    # Claude bos/kirpik donerse RAG sonuclarini kart olarak goster
    return _emit(fallback)


# ── Yol haritasi ───────────────────────────────────────────────────────────────

_TEMEL_KW = (
    "temel", "giris", "baslangic", "oryantasyon", "iletisim", "misafir",
    "hizmet", "operasyon", "excel", "ofis", "dil", "ingilizce", "yazilim",
    "kod", "python", "veri giris",
)
_UYGULAMA_KW = (
    "uygulama", "pratik", "proje", "analiz", "planlama", "satis", "pazarlama",
    "musteri", "sikayet", "operasyonel", "surec", "yetenek", "beceri",
)
_LIDERLIK_KW = (
    "lider", "yonet", "ekip", "koordin", "strateji", "gelir", "finans",
    "insan kaynak", "mentor", "karar", "yonetici", "mudur",
)


def _normalize_trainings_payload(trainings):
    out = []
    for t in trainings or []:
        if not isinstance(t, dict):
            continue
        tid = str(t.get("training_id") or t.get("id") or t.get("link") or t.get("ad") or "").strip()
        name = str(t.get("training_name") or t.get("ad") or t.get("name") or "").strip()
        if not tid and not name:
            continue
        if not tid:
            tid = name
        out.append({
            "training_id": tid,
            "training_name": name or tid,
            "yetkinlik": str(t.get("yetkinlik") or t.get("tag") or "").strip(),
            "gerekce": str(t.get("gerekce") or "").strip(),
        })
        if len(out) >= 12:
            break
    return out


def _bucket_for_training(t):
    blob = " ".join([
        t.get("training_name") or "",
        t.get("yetkinlik") or "",
        t.get("gerekce") or "",
    ]).lower()
    if any(k in blob for k in _LIDERLIK_KW):
        return 2
    if any(k in blob for k in _UYGULAMA_KW):
        return 1
    if any(k in blob for k in _TEMEL_KW):
        return 0
    return 1  # varsayilan: uygulama


def roadmap_fallback(hedef, yetkinlikler, trainings):
    """Claude basarisizsa egitimleri Temel / Uygulama / Liderlik kovalarina bol."""
    buckets = [[], [], []]
    for t in trainings:
        buckets[_bucket_for_training(t)].append(t["training_id"])

    # Bos kova kalmasin: egitimleri sirayla dagit
    if trainings and not any(buckets):
        for i, t in enumerate(trainings):
            buckets[i % 3].append(t["training_id"])
    elif trainings:
        used = set(x for b in buckets for x in b)
        orphan = [t["training_id"] for t in trainings if t["training_id"] not in used]
        for i, tid in enumerate(orphan):
            buckets[i % 3].append(tid)

    titles = [
        ("Temel beceriler", "Hedefine giden yolda sağlam bir temel oluştur."),
        ("Uygulama ve pratik", "Öğrendiklerini gerçek senaryolarda uygula."),
        ("Liderlik ve ilerleme", "Rolüne yaklaşmak için yönetim ve karar becerilerini güçlendir."),
    ]
    zayif = [y for y in (yetkinlikler or []) if isinstance(y, dict)]
    if zayif:
        adlar = [str(y.get("yetkinlik") or "")[:60] for y in zayif[:3] if y.get("yetkinlik")]
        if adlar:
            titles[1] = (
                "Gelişim alanlarını güçlendir",
                "Öncelikli alanlar: " + ", ".join(adlar) + ".",
            )

    steps = []
    for i, (title, desc) in enumerate(titles):
        steps.append({
            "title": title,
            "description": desc,
            "training_ids": buckets[i],
        })
    if hedef:
        steps[0]["description"] = (
            f"Hedefin: {hedef[:160]}. " + steps[0]["description"]
        )[:280]
    return steps


def _sanitize_roadmap_steps(raw_steps, valid_ids):
    """3-5 adim, sadece bilinen training_id, tarih/maas vaadi yok sayilir."""
    if not isinstance(raw_steps, list):
        return None
    steps = []
    for item in raw_steps:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()[:120]
        desc = str(item.get("description") or "").strip()[:400]
        if not title:
            continue
        # Kesin tarih / maas vaadi iceren aciklamalari yumusat
        low = (title + " " + desc).lower()
        if re.search(r"\b\d{4}\b.*maas|maas.*\₺|\$\d|garantili is", low):
            desc = re.sub(r"(?i)maaş[^.]*\.?", "", desc).strip() or desc
        ids_raw = item.get("training_ids") or item.get("training_id") or []
        if isinstance(ids_raw, str):
            ids_raw = [ids_raw]
        tids = []
        for x in ids_raw:
            s = str(x).strip()
            if s in valid_ids and s not in tids:
                tids.append(s)
        steps.append({
            "title": title,
            "description": desc,
            "training_ids": tids,
        })
        if len(steps) >= 5:
            break
    if len(steps) < 3:
        return None
    return steps[:5]


def yol_haritasi_uret(hedef, yetkinlikler, trainings, a):
    """
    Claude'dan 3-5 adimlik JSON roadmap.
    Basarisizsa Temel/Uygulama/Liderlik fallback.
    Donus: { steps, source }
    """
    trainings = _normalize_trainings_payload(trainings)
    hedef = str(hedef or "").strip()[:400]
    yetkinlikler = yetkinlikler if isinstance(yetkinlikler, list) else []
    valid_ids = {t["training_id"] for t in trainings}

    if not trainings:
        # Egitim yoksa yine 3 adimlik iskelet
        return {
            "steps": roadmap_fallback(hedef, yetkinlikler, []),
            "source": "fallback",
        }

    y_satir = "\n".join(
        f"- {y.get('yetkinlik','')}: {y.get('puan','?')}/5 ({y.get('seviye','')})"
        for y in yetkinlikler if isinstance(y, dict) and y.get("yetkinlik")
    ) or "(yok)"
    egitim_json = json.dumps(
        [{"training_id": t["training_id"], "ad": t["training_name"]} for t in trainings],
        ensure_ascii=False,
    )

    sistem = """Sen CareerPick kariyer danismansin.
Gorev: kullanicinin kariyer hedefi icin 3 ile 5 adimlik basit bir yol haritasi uret.
Her adima verilen egitim listesinden 0 veya daha fazla training_id bagla.
Listede olmayan training_id UYDURMA.
Kesin tarih, maas rakami veya is garantisi VERME.
Sadece JSON dondur, baska metin yok:
{"steps":[{"title":"...","description":"...","training_ids":["..."]}]}
Kurallar: steps uzunlugu 3-5; title kisa; description 1-2 cumle."""

    user = (
        f"KARİYER HEDEFİ:\n{hedef or '(belirtilmedi)'}\n\n"
        f"ZAYIF / GELİŞTİRİLECEK YETKİNLİKLER:\n{y_satir}\n\n"
        f"ÖNERİLEN EĞİTİMLER (JSON):\n{egitim_json}"
    )

    try:
        r = a.messages.create(
            model=CLAUDE_MODEL, max_tokens=1600, system=sistem,
            messages=[{"role": "user", "content": user}],
        )
        txt = r.content[0].text.strip()
        d = _json_obj_bul(txt)
        if d:
            cleaned = _sanitize_roadmap_steps(d.get("steps"), valid_ids)
            if cleaned:
                # Hic egitim baglanmadiysa fallback'e dus
                if any(s["training_ids"] for s in cleaned) or not valid_ids:
                    return {"steps": cleaned, "source": "claude"}
    except Exception as e:
        print("[ERROR] roadmap claude:", repr(e))

    return {
        "steps": roadmap_fallback(hedef, yetkinlikler, trainings),
        "source": "fallback",
    }


# ── Mikro gorevler (haftalik pratik) ───────────────────────────────────────────

_DUE_HINTS = ("Pazartesi", "Çarşamba", "Cuma", "Pazar")

_MICRO_TEMPLATES = {
    "iletisim": [
        {"title": "Bir kişiden kısa geribildirim iste", "description": "Bugün birlikte çalıştığın birine nazikçe sor: bu hafta neyi daha iyi yapabilirdim? Cevabı 3 cümleyle not et.", "minutes": 15},
        {"title": "Aktif dinleme notu", "description": "Bir konuşmada önce özetleyip sonra kendi fikrini söyle. Özeti bir cümleyle yaz.", "minutes": 10},
        {"title": "Net bir istek cümlesi yaz", "description": "Belirsiz bir ihtiyacını 'Ne istiyorum / Ne zamana / Kimden' formatında yaz ve gerekiyorsa gönder.", "minutes": 15},
    ],
    "önceliklendirme": [
        {"title": "Acil / önemli matrisi", "description": "Bugünkü 5 işini acil-önemli matrisine yerleştir. En alttaki bir işi bilerek ertele.", "minutes": 15},
        {"title": "Tek öncelik seç", "description": "Yarın için tek bir 'mutlaka bitecek' iş seç ve nedenini 2 cümle yaz.", "minutes": 10},
        {"title": "Haftalık hayır listesi", "description": "Bu hafta yapmayacağın 2 şeyi yaz. Suçluluk yerine netlik hedefle.", "minutes": 10},
    ],
    "onceliklendirme": [
        {"title": "Acil / önemli matrisi", "description": "Bugünkü 5 işini acil-önemli matrisine yerleştir. En alttaki bir işi bilerek ertele.", "minutes": 15},
        {"title": "Tek öncelik seç", "description": "Yarın için tek bir 'mutlaka bitecek' iş seç ve nedenini 2 cümle yaz.", "minutes": 10},
        {"title": "Haftalık hayır listesi", "description": "Bu hafta yapmayacağın 2 şeyi yaz. Suçluluk yerine netlik hedefle.", "minutes": 10},
    ],
    "takım": [
        {"title": "Takımda bir teşekkür", "description": "Bir ekip arkadaşının somut katkısını fark et ve ona kısa bir teşekkür ilet.", "minutes": 10},
        {"title": "Rol netliği notu", "description": "Ortak bir işte 'ben / sen / birlikte' sorumluluklarını 3 satırda yaz.", "minutes": 15},
        {"title": "Kısa check-in sorusu", "description": "Birine 'Bugün sende neye ihtiyaç var?' diye sor; cevabı dinle, çözüm dayatma.", "minutes": 10},
    ],
    "problem": [
        {"title": "Problemi tek cümlede tanımla", "description": "Canını sıkan bir durumu tek cümlede yaz: kim etkileniyor, ne eksik?", "minutes": 10},
        {"title": "İki seçenek üret", "description": "Aynı probleme en az iki farklı yaklaşım yaz; hangisini denerdin neden?", "minutes": 15},
        {"title": "Küçük deney", "description": "Çözümün en küçük test edilebilir adımını bugün dene ve sonucu not et.", "minutes": 20},
    ],
    "öğrenme": [
        {"title": "10 dakikalık öğrenme bloğu", "description": "Hedefinle ilgili bir makale veya video izle; 3 madde özet yaz.", "minutes": 15},
        {"title": "Bir şeyi başkasına anlat", "description": "Öğrendiğin bir konuyu birine (veya kendine sesli) 2 dakikada anlat.", "minutes": 10},
        {"title": "Hata günlüğü", "description": "Bu hafta bir hatanı yaz: ne oldu, ne öğrendim, sonraki denemede ne değişir?", "minutes": 15},
    ],
    "ogrenme": [
        {"title": "10 dakikalık öğrenme bloğu", "description": "Hedefinle ilgili bir makale veya video izle; 3 madde özet yaz.", "minutes": 15},
        {"title": "Bir şeyi başkasına anlat", "description": "Öğrendiğin bir konuyu birine (veya kendine sesli) 2 dakikada anlat.", "minutes": 10},
        {"title": "Hata günlüğü", "description": "Bu hafta bir hatanı yaz: ne oldu, ne öğrendim, sonraki denemede ne değişir?", "minutes": 15},
    ],
    "analitik": [
        {"title": "Veriyi 3 soruya indir", "description": "Bir karar için hangi 3 veri noktası yeterli olurdu? Listele.", "minutes": 15},
        {"title": "Varsayımı yaz", "description": "Bir fikrinin arkasındaki varsayımı tek cümlede yaz; onu nasıl test edersin?", "minutes": 10},
        {"title": "Basit karşılaştırma", "description": "İki seçeneği artı/eksi tablosunda karşılaştır; sonucu bir cümleyle özetle.", "minutes": 15},
    ],
    "liderlik": [
        {"title": "Net beklenti cümlesi", "description": "Bir iş için beklediğin sonucu 'ne / ne zaman / nasıl başarılı' diye yaz.", "minutes": 15},
        {"title": "Delege etmeyi dene", "description": "Kendinin yaptığı küçük bir işi başkasına bırakmayı planla veya sor.", "minutes": 15},
        {"title": "Karar notu", "description": "Aldığın veya ertelediğin bir kararı yaz: gerekçe + sonraki kontrol tarihi.", "minutes": 10},
    ],
}

_GENERAL_MICRO = [
    {"title": "15 dakikalık odak bloğu", "description": "Telefonsuz 15 dk tek bir işe odaklan. Bitince ne tamamlandığını bir cümle yaz.", "minutes": 15},
    {"title": "Haftalık mini hedef", "description": "Bu hafta için tek, ölçülebilir küçük bir hedef yaz (kurs değil, pratik bir eylem).", "minutes": 10},
    {"title": "Günün kısa özeti", "description": "Günün sonunda: ne iyi gitti / ne zorlandı / yarın ilk adım — 3 satır.", "minutes": 10},
    {"title": "Birini gözlemle ve not al", "description": "İyi yapan birini izle; onun yaptığı 1 somut davranışı not et ve dene.", "minutes": 15},
]


def _normalize_yetkinlik_key(name):
    s = (name or "").strip().lower()
    s = re.sub(r"\s+", " ", s)
    # TR I/İ yaklasimi: basit lower yeterli degilse ek temizle
    return s


def _template_key_for(yetkinlik):
    key = _normalize_yetkinlik_key(yetkinlik)
    for k in _MICRO_TEMPLATES:
        if k in key or key in k:
            return k
    # Anahtar kelime eslesmesi
    mapping = (
        ("iletisim", "iletisim"),
        ("iletişim", "iletisim"),
        ("öncelik", "onceliklendirme"),
        ("oncelik", "onceliklendirme"),
        ("takım", "takım"),
        ("takim", "takım"),
        ("ekip", "takım"),
        ("problem", "problem"),
        ("çözüm", "problem"),
        ("ogrenme", "ogrenme"),
        ("öğrenme", "öğrenme"),
        ("analitik", "analitik"),
        ("analiz", "analitik"),
        ("lider", "liderlik"),
        ("yönet", "liderlik"),
        ("yonet", "liderlik"),
    )
    for needle, bucket in mapping:
        if needle in key:
            return bucket
    return None


def _weak_yetkinlikler(yetkinlikler, limit=2):
    weak = []
    for y in yetkinlikler or []:
        if not isinstance(y, dict):
            continue
        ad = (y.get("yetkinlik") or y.get("yetkinlik_adi") or "").strip()
        if not ad:
            continue
        seviye = (y.get("seviye") or "").strip()
        try:
            puan = float(y.get("puan", 5))
        except (TypeError, ValueError):
            puan = 5.0
        if seviye == "gelistirilmeli" or puan < EKSIK_ESIGI:
            weak.append({"yetkinlik": ad, "puan": puan, "seviye": seviye or "gelistirilmeli"})
    weak.sort(key=lambda x: x["puan"])
    return weak[:limit]


def micro_tasks_from_templates(yetkinlikler, max_tasks=4):
    """Fallback: sablon havuzundan 2-4 gorev."""
    weak = _weak_yetkinlikler(yetkinlikler, limit=2)
    if not weak:
        weak = [{"yetkinlik": "genel iş becerisi", "puan": 3.0, "seviye": "gelistirilmeli"}]

    picked = []
    for w in weak:
        bucket = _template_key_for(w["yetkinlik"])
        pool = list(_MICRO_TEMPLATES.get(bucket, [])) if bucket else []
        if not pool:
            pool = list(_GENERAL_MICRO)
        for t in pool:
            if len(picked) >= max_tasks:
                break
            picked.append({
                "yetkinlik": w["yetkinlik"],
                "title": t["title"],
                "description": t["description"],
                "minutes": t.get("minutes") or 15,
            })
        if len(picked) >= max_tasks:
            break

    while len(picked) < 2:
        g = _GENERAL_MICRO[len(picked) % len(_GENERAL_MICRO)]
        picked.append({
            "yetkinlik": weak[0]["yetkinlik"],
            "title": g["title"],
            "description": g["description"],
            "minutes": g.get("minutes") or 15,
        })

    out = []
    for i, t in enumerate(picked[:max_tasks]):
        mins = int(t.get("minutes") or 15)
        mins = max(10, min(30, mins))
        out.append({
            "yetkinlik_adi": _normalize_yetkinlik_key(t["yetkinlik"]),
            "yetkinlik_label": t["yetkinlik"],
            "title": t["title"][:160],
            "description": (t.get("description") or "")[:400],
            "minutes": mins,
            "due_hint": _DUE_HINTS[i % len(_DUE_HINTS)],
        })
    return out


def _sanitize_micro_tasks(raw_tasks, weak_labels, max_tasks=4):
    if not isinstance(raw_tasks, list):
        return None
    default_label = weak_labels[0] if weak_labels else "genel iş becerisi"
    out = []
    for item in raw_tasks:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()[:160]
        desc = str(item.get("description") or "").strip()[:400]
        if not title:
            continue
        blob = (title + " " + desc).lower()
        if re.search(r"maas|maaş|\$\d|garantili is|garantili iş", blob):
            continue
        try:
            mins = int(item.get("minutes") or item.get("dakika") or 15)
        except (TypeError, ValueError):
            mins = 15
        mins = max(10, min(30, mins))
        label = str(item.get("yetkinlik") or item.get("yetkinlik_label") or default_label).strip()
        out.append({
            "yetkinlik_adi": _normalize_yetkinlik_key(label),
            "yetkinlik_label": label,
            "title": title,
            "description": desc,
            "minutes": mins,
            "due_hint": _DUE_HINTS[len(out) % len(_DUE_HINTS)],
        })
        if len(out) >= max_tasks:
            break
    if len(out) < 2:
        return None
    return out[:max_tasks]


def mikro_gorev_uret(yetkinlikler, a):
    """
    Claude'dan 2-4 mikro gorev; basarisizsa sablon.
    Donus: { tasks, source }
    """
    weak = _weak_yetkinlikler(yetkinlikler, limit=2)
    if not weak:
        tasks = micro_tasks_from_templates([], max_tasks=3)
        return {"tasks": tasks, "source": "template"}

    labels = [w["yetkinlik"] for w in weak]
    paket = json.dumps(weak, ensure_ascii=False)
    sistem = """Sen CareerPick kariyer kocusun.
Zayif yetkinlikler icin 1 haftalik KISA pratikler uret (egitim/kurs DEGIL).
Her gorev 10-30 dakika, is/yasam icinde uygulanabilir.
Kesin tarih, maas veya is garantisi VERME. Suclayici dil kullanma.
Toplam 2 ile 4 gorev (en fazla 4).
Sadece JSON:
{"tasks":[{"yetkinlik":"...","title":"...","description":"...","minutes":15}]}"""

    try:
        r = a.messages.create(
            model=CLAUDE_MODEL, max_tokens=900, system=sistem,
            messages=[{"role": "user", "content": f"ZAYIF YETKINLIKLER:\n{paket}"}],
        )
        txt = r.content[0].text.strip()
        d = _json_obj_bul(txt)
        if d:
            cleaned = _sanitize_micro_tasks(d.get("tasks"), labels, max_tasks=4)
            if cleaned:
                return {"tasks": cleaned, "source": "claude"}
    except Exception as e:
        print("[ERROR] micro_tasks claude:", repr(e))

    return {
        "tasks": micro_tasks_from_templates(yetkinlikler, max_tasks=4),
        "source": "template",
    }


# ── HTTP ───────────────────────────────────────────────────────────────────────

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


def _normalize_cevaplar(cevaplar, limit=24):
    out = []
    for c in cevaplar:
        if not isinstance(c, dict):
            continue
        out.append({
            "soru": str(c.get("soru", ""))[:MAX_FIELD_LEN],
            "cevap": str(c.get("cevap", ""))[:MAX_FIELD_LEN],
            "key": str(c.get("key", ""))[:120],
            "type": str(c.get("type", "profile"))[:40],
            "yetkinlik": str(c.get("yetkinlik", ""))[:200],
            "ana_yetkinlik_rubrik": str(c.get("ana_yetkinlik_rubrik", ""))[:500],
        })
        if len(out) >= limit:
            break
    return out


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
                tip = (data.get("type") or "profile").strip()
                yetkinlik = (data.get("yetkinlik") or "").strip()
                attempt = data.get("attempt", 0)
                if not cevap:
                    return self._json(400, {"error": "Cevap bos olamaz."})
                if len(soru) > MAX_FIELD_LEN or len(cevap) > MAX_FIELD_LEN:
                    return self._json(400, {"error": "Girdi cok uzun."})
                a, _, _ = _clients()
                return self._json(200, degerlendir(soru, cevap, a, tip, yetkinlik, attempt))

            elif action == "scenarios":
                cevaplar = data.get("cevaplar")
                if not isinstance(cevaplar, list) or not cevaplar:
                    return self._json(400, {"error": "Cevaplar eksik."})
                cevaplar = _normalize_cevaplar(cevaplar)
                _, o, q = _clients()
                return self._json(200, senaryolari_hazirla(cevaplar, o, q))

            elif action == "recommend":
                cevaplar = data.get("cevaplar")
                if not isinstance(cevaplar, list) or not cevaplar:
                    return self._json(400, {"error": "Cevaplar eksik."})
                cevaplar = _normalize_cevaplar(cevaplar)
                a, o, q = _clients()
                session_id = data.get("sessionId") or data.get("session_id")
                user_id = data.get("userId") or data.get("user_id")
                recs, yetkinlikler = oner(
                    cevaplar, a, o, q,
                    session_id=session_id,
                    user_id=user_id,
                )
                return self._json(200, {
                    "recommendations": recs,
                    "yetkinlikler": yetkinlikler,
                })

            elif action == "roadmap":
                hedef = str(data.get("hedef") or "").strip()[:400]
                yetkinlikler = data.get("yetkinlikler") if isinstance(data.get("yetkinlikler"), list) else []
                trainings = data.get("trainings") if isinstance(data.get("trainings"), list) else []
                if not hedef and not trainings:
                    return self._json(400, {"error": "Hedef veya egitim listesi gerekli."})
                a, _, _ = _clients()
                result = yol_haritasi_uret(hedef, yetkinlikler, trainings, a)
                return self._json(200, result)

            elif action == "compare_summary":
                rows = data.get("rows") if isinstance(data.get("rows"), list) else []
                if not rows:
                    return self._json(200, {"summary": ""})
                a, _, _ = _clients()
                improved = [
                    r for r in rows
                    if isinstance(r, dict) and r.get("status") == "improved"
                ]
                paket = json.dumps(rows[:12], ensure_ascii=False)[:2500]
                sistem = (
                    "CareerPick icin tek cumle Turkce ozet yaz. "
                    "Kesin bilimsel olcum iddiasinda bulunma; yaklasik gelisim sinyali de. "
                    "En cok ilerleme varsa onu nazikce belirt. Suclamayici dil kullanma. "
                    "Sadece 1 cumle, baska metin yok."
                )
                try:
                    r = a.messages.create(
                        model=CLAUDE_MODEL, max_tokens=120, system=sistem,
                        messages=[{"role": "user", "content": f"KARSILASTIRMA:\n{paket}"}],
                    )
                    summary = (r.content[0].text or "").strip().split("\n")[0][:220]
                    if improved and not summary:
                        top = max(improved, key=lambda x: float(x.get("delta") or 0))
                        ad = top.get("yetkinlik") or "bir alanda"
                        summary = f"Bu turda en belirgin ilerleme sinyali {ad} alanında görünüyor."
                    return self._json(200, {"summary": summary})
                except Exception as e:
                    print("[ERROR] compare_summary:", repr(e))
                    if improved:
                        top = max(improved, key=lambda x: float(x.get("delta") or 0))
                        ad = top.get("yetkinlik") or "bir alanda"
                        return self._json(200, {
                            "summary": f"Bu turda en belirgin ilerleme sinyali {ad} alanında görünüyor.",
                        })
                    return self._json(200, {"summary": ""})

            elif action == "micro_tasks":
                yetkinlikler = data.get("yetkinlikler") if isinstance(data.get("yetkinlikler"), list) else []
                a, _, _ = _clients()
                result = mikro_gorev_uret(yetkinlikler, a)
                return self._json(200, result)

            elif action == "personalize_sector_note":
                # Opsiyonel: not govdesi sabittir; sadece tek cumle ek.
                title = str(data.get("title") or "")[:200]
                body = str(data.get("body") or "")[:1200]
                hedef = str(data.get("hedef") or "")[:300]
                sektor = str(data.get("sektor") or "")[:200]
                if not body:
                    return self._json(200, {"line": ""})
                try:
                    a = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
                    sistem = (
                        "CareerPick mentor asistanisin. Verilen kisa sektor notuna uygun, "
                        "kullanicinin hedefine ozel TEK cumle yaz. "
                        "Kesin maas, tarih veya ise alim garantisi verme. "
                        "Sadece 1 cumle, baska metin yok. Turkce."
                    )
                    user_msg = (
                        f"BASLIK: {title}\n"
                        f"NOT: {body}\n"
                        f"HEDEF_SEKTOR: {sektor or 'belirtilmedi'}\n"
                        f"KARIYER_HEDEFI: {hedef or 'belirtilmedi'}\n"
                    )
                    r = a.messages.create(
                        model=CLAUDE_MODEL,
                        max_tokens=80,
                        system=sistem,
                        messages=[{"role": "user", "content": user_msg}],
                    )
                    line = (r.content[0].text or "").strip().split("\n")[0].strip()
                    line = line[:220]
                    return self._json(200, {"line": line})
                except Exception as e:
                    print("[ERROR] personalize_sector_note:", repr(e))
                    return self._json(200, {"line": ""})

            elif action == "checkin_reflect":
                q1 = str(data.get("q1") or "")[:800]
                q2 = str(data.get("q2") or "")[:400]
                choice = str(data.get("q2_choice") or "").strip()
                hedef = str(data.get("hedef") or "")[:300]
                choice_labels = {
                    "egitim": "egitim",
                    "pratik": "pratik",
                    "basvuru": "basvuru",
                    "belirsiz": "netlesecek bir odak",
                }
                focus = choice_labels.get(choice) or (q2.strip()[:80] if q2.strip() else "oncelik")
                fallback = (
                    f"Notunu aldık — gelecek hafta odağın: {focus}. Küçük bir adım yeterli."
                )
                if not q1.strip():
                    return self._json(200, {"reflection": fallback, "source": "template"})
                try:
                    a = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
                    sistem = (
                        "CareerPick mentor asistanisin. Haftalik check-in yanitina "
                        "yumusak, destekleyici TEK cumlelik bir yansima yaz. "
                        "Kesin maas, tarih veya ise alim garantisi verme. "
                        "Sadece 1 cumle, baska metin yok. Turkce."
                    )
                    user_msg = (
                        f"BU_HAFTA: {q1}\n"
                        f"GELECEK_ONCELIK: {q2 or 'belirtilmedi'}\n"
                        f"SECIM: {choice or 'yok'}\n"
                        f"KARIYER_HEDEFI: {hedef or 'belirtilmedi'}\n"
                    )
                    r = a.messages.create(
                        model=CLAUDE_MODEL,
                        max_tokens=80,
                        system=sistem,
                        messages=[{"role": "user", "content": user_msg}],
                    )
                    line = (r.content[0].text or "").strip().split("\n")[0].strip()[:220]
                    if not line:
                        line = fallback
                    return self._json(200, {"reflection": line, "source": "claude"})
                except Exception as e:
                    print("[ERROR] checkin_reflect:", repr(e))
                    return self._json(200, {"reflection": fallback, "source": "template"})

            else:
                return self._json(400, {"error": "Gecersiz action."})

        except KeyError as e:
            print("[ERROR] eksik env:", str(e))
            return self._json(500, {"error": "Sunucu yapilandirmasi eksik."})
        except Exception as e:
            print("[ERROR]", repr(e))
            return self._json(503, {"error": "AI servisi su an kullanilamiyor, lutfen tekrar deneyin."})

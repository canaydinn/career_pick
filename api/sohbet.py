"""
CareerPick — Kariyer Sohbeti backend (Vercel Serverless Function)
=================================================================
POST /api/sohbet

Islemler (action):

1) evaluate  — yanit yeterliligi (max 1 takip; kisa ama net cevaplar kabul)
2) scenarios — profil yanitlarina gore RAG'den meta_senaryo ceker
3) recommend — profil + senaryo puanlariyla egitim onerir

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
        kurslar.append({
            "ad":       pl.get("kurs_egitim_adi") or pl.get("baslik") or "",
            "kurum":    pl.get("kurum_adi") or "",
            "kategori": pl.get("kategori") or "",
            "sehir":    pl.get("sehir") or "",
            "link":     pl.get("sayfa_linki") or pl.get("link") or "",
        })
    return kurslar


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


def oner(cevaplar, a, o, q):
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

    # Kariyer hedefi once; uzun yetkinlik unvanlari aramayi bozmasin
    arama = " ".join(
        p for p in [hedef, sektor, beceriler, " ".join(eksik_terimler[:2]), "egitim sertifika"]
        if p
    ).strip() or "kariyer egitimi"

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

    if not kurslar:
        return [], yetkinlikler

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

    kurs_json = json.dumps(kurslar, ensure_ascii=False)
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
                    return temiz, yetkinlikler
    except Exception as e:
        print("[ERROR] oner claude:", repr(e))

    # Claude bos/kirpik donerse RAG sonuclarini kart olarak goster
    return fallback, yetkinlikler


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
                recs, yetkinlikler = oner(cevaplar, a, o, q)
                return self._json(200, {
                    "recommendations": recs,
                    "yetkinlikler": yetkinlikler,
                })

            else:
                return self._json(400, {"error": "Gecersiz action."})

        except KeyError as e:
            print("[ERROR] eksik env:", str(e))
            return self._json(500, {"error": "Sunucu yapilandirmasi eksik."})
        except Exception as e:
            print("[ERROR]", repr(e))
            return self._json(503, {"error": "AI servisi su an kullanilamiyor, lutfen tekrar deneyin."})

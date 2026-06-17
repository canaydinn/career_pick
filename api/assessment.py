"""
CareerPick Chatbot — Orkestrasyon Motoru (Vercel Serverless Function)
=====================================================================
Kullaniciyla 4 asamali bir degerlendirme sohbeti yurutur.

Bu dosya Vercel uzerinde POST /api/assessment endpoint'i olarak calisir.
Sunucu STATELESS'tir: session her istekte sifrelenmis (Fernet/AES) bir
token olarak istemciye gonderilir ve geri alinir. Boylece harici bir
veritabani gerekmez ve istemci ic puanlari/rubrikleri goremez/degistiremez.

Gerekli ortam degiskenleri (Vercel dashboard'da Production icin ayarlayin):
    ANTHROPIC_API_KEY : Claude API anahtari
    OPENAI_API_KEY    : Embedding icin OpenAI anahtari
    QDRANT_URL        : Qdrant adresi
    QDRANT_API_KEY    : Qdrant Cloud API anahtari
    SESSION_SECRET    : Session token sifreleme parolasi (uzun, rastgele)
    CLAUDE_MODEL      : (opsiyonel) Claude model adi
    ALLOWED_ORIGINS   : (opsiyonel) virgulle ayrilmis izinli origin listesi
"""

import os
import json
import re
import time
import base64
import hashlib
from http.server import BaseHTTPRequestHandler

from openai import OpenAI
from anthropic import Anthropic
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
from cryptography.fernet import Fernet, InvalidToken

# ── Sabitler ───────────────────────────────────────────────────────────────────

COLLECTION_NAME        = "careerpick"
EGITIM_COLLECTION_NAME = "edupick_egitimler"
EMBEDDING_MODEL        = "text-embedding-3-large"
CLAUDE_MODEL           = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")
META_SENARYO_SAYISI    = 5
DERINLEME_SAYISI       = 3
EKSIK_ESIGI            = 3.0

# Guvenlik sinirlari
MAX_MESSAGE_LEN  = 4000          # tek kullanici mesaji ust siniri
MAX_TOKEN_LEN    = 200_000       # session token ust siniri (karakter)
SESSION_TTL_SEC  = 60 * 60 * 3   # 3 saat
RATE_LIMIT_MAX   = 30            # pencere basina maksimum istek
RATE_LIMIT_WIN   = 60            # saniye

# Best-effort, instance-yerel rate limit (cold start'ta sifirlanir).
# Saglam limit icin Upstash/Vercel KV onerilir.
_RATE_BUCKET: dict[str, list[float]] = {}


# ── Client Baslatma (env-only, sabit anahtar YOK) ──────────────────────────────

def clientlari_baslat():
    anthropic_client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    openai_client    = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    qdrant_client    = QdrantClient(
        url=os.environ["QDRANT_URL"],
        api_key=os.environ["QDRANT_API_KEY"],
        timeout=60,
    )
    return anthropic_client, openai_client, qdrant_client


# ── Session ────────────────────────────────────────────────────────────────────

def yeni_session() -> dict:
    return {
        "asama"                  : 1,
        "hedef_kariyer"          : None,
        "mevcut_durum"           : None,
        "meslek_profili"         : None,
        "kritik_yetkinlikler"    : [],
        "sunulan_senaryolar"     : [],
        "bekleyen_senaryo"       : None,
        "yetkinlik_puanlari"     : {},
        "cevaplanan_soru_sayisi" : 0,
        "eksik_yetkinlikler"     : [],
        "guclu_yetkinlikler"     : [],
        "mesajlar"               : [],
        "tamamlandi"             : False,
    }


# ── Session Sifreleme (stateless, tamper-proof) ────────────────────────────────

def _fernet() -> Fernet:
    secret = os.environ.get("SESSION_SECRET")
    if not secret:
        raise RuntimeError("SESSION_SECRET tanimli degil")
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def _slim_session(session: dict) -> dict:
    """Token boyutunu kucultmek icin gereksiz/agir alanlari kirp.
    Bir sonraki turda yalnizca bekleyen_senaryo'nun tam rubrigine ihtiyac var."""
    s = dict(session)

    # Gecmis senaryolardan sadece dedup/ilerleme icin gereken alanlar.
    s["sunulan_senaryolar"] = [
        {
            "senaryo_no"  : x.get("senaryo_no"),
            "yetkinlik_no": x.get("yetkinlik_no"),
            "chunk_type"  : x.get("chunk_type"),
        }
        for x in session.get("sunulan_senaryolar", [])
    ]

    # meslek_profili'nin uzun 'text' alanini token'da tasimaya gerek yok.
    mp = session.get("meslek_profili")
    if mp:
        s["meslek_profili"] = {
            "meslek_adi"        : mp.get("meslek_adi", ""),
            "yetkinlik_kodlari" : mp.get("yetkinlik_kodlari", []),
            "text"              : "",
        }

    # Konusma gecmisini son 12 mesajla sinirly tut.
    s["mesajlar"] = session.get("mesajlar", [])[-12:]
    return s


def session_encode(session: dict) -> str:
    raw = json.dumps(_slim_session(session), ensure_ascii=False).encode("utf-8")
    return _fernet().encrypt(raw).decode("ascii")


def session_decode(token: str) -> dict:
    raw = _fernet().decrypt(token.encode("ascii"), ttl=SESSION_TTL_SEC)
    data = json.loads(raw.decode("utf-8"))
    # JSON int anahtarlari string'e cevirir; geri al.
    data["yetkinlik_puanlari"] = {
        int(k): float(v) for k, v in data.get("yetkinlik_puanlari", {}).items()
    }
    # Yeni alan(lar) icin geriye donuk uyumluluk
    yeni = yeni_session()
    for k, v in yeni.items():
        data.setdefault(k, v)
    return data


# ── RAG ─────────────────────────────────────────────────────────────────────────

def metin_embed_et(metin: str, openai_client: OpenAI) -> list:
    response = openai_client.embeddings.create(model=EMBEDDING_MODEL, input=[metin])
    return response.data[0].embedding


def meslek_profili_getir(hedef_kariyer, openai_client, qdrant_client):
    vektor   = metin_embed_et(hedef_kariyer, openai_client)
    sonuclar = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=vektor,
        query_filter=Filter(must=[
            FieldCondition(key="chunk_type", match=MatchValue(value="meslek_profili"))
        ]),
        limit=1,
        with_payload=True,
    )
    if not sonuclar.points:
        return None
    payload = sonuclar.points[0].payload
    return {
        "meslek_adi"        : payload.get("meslek_adi", ""),
        "yetkinlik_kodlari" : payload.get("yetkinlik_kodlari", []),
        "text"              : payload.get("text", ""),
    }


def yetkinlik_nolarini_cikar(yetkinlik_kodlari: list) -> list:
    nolar = set()
    for kod in yetkinlik_kodlari:
        match = re.match(r"(\d+)-", str(kod))
        if match:
            nolar.add(int(match.group(1)))
    return sorted(list(nolar))


def yetkinlik_adlarini_getir(yetkinlik_kodlari: list, nolar: list) -> dict:
    adlar = {}
    for kod in yetkinlik_kodlari:
        match = re.match(r"(\d+)-(.+)", str(kod))
        if match:
            no = int(match.group(1))
            if no in nolar:
                adlar[no] = match.group(2).strip()
    return adlar


def meta_senaryo_getir(yetkinlik_nolari, sunulan_idler, openai_client, qdrant_client, adet=1):
    vektor = metin_embed_et(
        f"yetkinlik degerlendirme {' '.join(str(n) for n in yetkinlik_nolari[:5])}",
        openai_client,
    )
    sonuclar = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=vektor,
        query_filter=Filter(must=[
            FieldCondition(key="chunk_type", match=MatchValue(value="meta_senaryo"))
        ]),
        limit=adet + len(sunulan_idler) + 5,
        with_payload=True,
    )
    filtreli = [
        s for s in sonuclar.points
        if s.payload.get("senaryo_no") not in sunulan_idler
    ]
    return [s.payload for s in filtreli[:adet]]


def derinleme_senaryo_getir(yetkinlik_no, qdrant_client):
    sonuclar = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=[0.01] * 3072,
        query_filter=Filter(must=[
            FieldCondition(key="chunk_type",   match=MatchValue(value="makro_senaryo")),
            FieldCondition(key="yetkinlik_no", match=MatchValue(value=yetkinlik_no)),
        ]),
        limit=1,
        with_payload=True,
    )
    if not sonuclar.points:
        return None
    return sonuclar.points[0].payload


def egitim_onerileri_getir(session, openai_client, qdrant_client, adet=5):
    """edupick_egitimler koleksiyonundan hedef kariyere ve gelisim alanlarina
    uygun egitim onerileri getirir."""
    baglam_parcalari = [
        session.get("hedef_kariyer") or "",
        session.get("mevcut_durum") or "",
    ]

    meslek_profili = session.get("meslek_profili")
    if meslek_profili:
        baglam_parcalari.append(meslek_profili.get("meslek_adi", ""))
        gelisim_adlari = yetkinlik_adlarini_getir(
            meslek_profili.get("yetkinlik_kodlari", []),
            session.get("eksik_yetkinlikler", [])[:3],
        )
        baglam_parcalari.extend(gelisim_adlari.values())

    arama_metni = " ".join(p for p in baglam_parcalari if p) or "kariyer egitimi"
    vektor = metin_embed_et(arama_metni, openai_client)

    sonuclar = qdrant_client.query_points(
        collection_name=EGITIM_COLLECTION_NAME,
        query=vektor,
        limit=adet,
        with_payload=True,
    )
    return [s.payload for s in sonuclar.points]


def _egitim_metni_olustur(egitim_oneriler: list, adet: int = 5) -> str:
    """edupick_egitimler payload alanlarina gore okunakli egitim listesi uretir.
    Gercek alanlar: kurs_egitim_adi, kurum_adi, kategori, sehir, i_lce, sayfa_linki."""
    satirlar = []
    for e in egitim_oneriler[:adet]:
        ad     = e.get("kurs_egitim_adi") or e.get("baslik") or e.get("egitim_adi") or "Egitim"
        kurum  = e.get("kurum_adi") or e.get("platform") or ""
        kat    = e.get("kategori") or ""
        sehir  = e.get("sehir") or ""
        ilce   = e.get("i_lce") or e.get("ilce") or ""
        yer    = ", ".join(p for p in [sehir, ilce] if p)
        link   = e.get("sayfa_linki") or e.get("link") or ""
        detay  = " | ".join(p for p in [kurum, kat, yer] if p)
        satir  = f"- {ad}"
        if detay:
            satir += f" ({detay})"
        if link:
            satir += f"\n  Link: {link}"
        satirlar.append(satir)
    return "\n".join(satirlar)


# ── Degerlendirme ────────────────────────────────────────────────────────────────

def cevabi_puan_ver(senaryo, kullanici_cevabi, anthropic_client):
    rubrik = f"""
ANA YETKINLIK ({senaryo.get('ana_yetkinlik_adi', '')}):
{senaryo.get('ana_yetkinlik_rubrik', '')[:500]}

IKINCIL 1 ({senaryo.get('ikincil_yetkinlik_1_adi', '')}):
{senaryo.get('ikincil_yetkinlik_1_rubrik', '')[:300]}

IKINCIL 2 ({senaryo.get('ikincil_yetkinlik_2_adi', '')}):
{senaryo.get('ikincil_yetkinlik_2_rubrik', '')[:300]}
"""
    prompt = f"""Davranissal yetkinlik degerlendirme uzmanisin.

SENARYO:
{senaryo.get('senaryo_metni', '')[:600]}

KULLANICI CEVABI:
{kullanici_cevabi}

DEGERLENDIRME RUBRIGI:
{rubrik}

Sadece su JSON formatinda yanit ver:
{{
  "puanlar": {{
    "{senaryo.get('ana_yetkinlik_no', 0)}": <1-5>,
    "{senaryo.get('ikincil_yetkinlik_1_no', 0)}": <1-5>,
    "{senaryo.get('ikincil_yetkinlik_2_no', 0)}": <1-5>
  }},
  "genel_yorum": "<max 2 cumle>"
}}"""

    yanit = anthropic_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    try:
        metin = yanit.content[0].text.strip()
        json_match = re.search(r'\{.*\}', metin, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception:
        pass
    return {"puanlar": {str(senaryo.get('ana_yetkinlik_no', 0)): 3}, "genel_yorum": "Tamamlandi."}


def puanlari_guncelle(session, yeni_puanlar):
    for no_str, puan in yeni_puanlar.items():
        try:
            no = int(no_str)
            if no == 0:
                continue
            mevcut = session["yetkinlik_puanlari"].get(no)
            if mevcut is None:
                session["yetkinlik_puanlari"][no] = float(puan)
            else:
                session["yetkinlik_puanlari"][no] = (mevcut + float(puan)) / 2
        except (ValueError, TypeError):
            continue


def eksik_guclu_hesapla(session):
    eksikler = [n for n, p in session["yetkinlik_puanlari"].items() if p < EKSIK_ESIGI]
    guclular = [n for n, p in session["yetkinlik_puanlari"].items() if p >= EKSIK_ESIGI]
    eksikler.sort(key=lambda n: session["yetkinlik_puanlari"][n])
    guclular.sort(key=lambda n: session["yetkinlik_puanlari"][n], reverse=True)
    session["eksik_yetkinlikler"] = eksikler
    session["guclu_yetkinlikler"] = guclular


# ── Claude Yanit ─────────────────────────────────────────────────────────────────

def claude_yanit_uret(sistem, mesajlar, anthropic_client, max_tokens=1000):
    yanit = anthropic_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=sistem,
        messages=mesajlar,
    )
    return yanit.content[0].text.strip()


# ── Asamalar ──────────────────────────────────────────────────────────────────────

def asama1_kullanici_tanima(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client):
    sistem = """Sen CareerPick platformunun kariyer rehberi asistanisin.
Gorevin kullanicinin hedef kariyerini ve mevcut durumunu (ogrenci/mezun/deneyimli) ogrenmek.

Kurallar:
- Sicak, samimi ve kisa cevaplar ver
- Bir seferde sadece 1 soru sor
- Kullanici hem hedef kariyerini hem mevcut durumunu soylediyse
  yanitinin SONUNA sunu ekle:
  [HAZIR: {"hedef_kariyer": "...", "mevcut_durum": "ogrenci/mezun/deneyimli"}]
- Henuz yeterli bilgi yoksa soru sormaya devam et"""

    session["mesajlar"].append({"role": "user", "content": kullanici_mesaji})
    yanit = claude_yanit_uret(sistem, session["mesajlar"], anthropic_client)

    hazir_match = re.search(r'\[HAZIR:\s*(\{.*?\})\]', yanit, re.DOTALL)
    if hazir_match:
        try:
            bilgi = json.loads(hazir_match.group(1))
            session["hedef_kariyer"] = bilgi.get("hedef_kariyer", "")
            session["mevcut_durum"]  = bilgi.get("mevcut_durum", "")

            profil = meslek_profili_getir(session["hedef_kariyer"], openai_client, qdrant_client)
            if profil:
                session["meslek_profili"]      = profil
                session["kritik_yetkinlikler"] = yetkinlik_nolarini_cikar(profil["yetkinlik_kodlari"])

            yanit_temiz = yanit.replace(hazir_match.group(0), "").strip()
            session["asama"] = 2
            yanit_temiz += "\n\nHarika! Simdi sana birkac durum senaryosu sunacagim. Her senaryoyu okuyup ilk tepkini ve nedenini yaz. Hazir misin?"
        except json.JSONDecodeError:
            yanit_temiz = yanit
    else:
        yanit_temiz = yanit

    session["mesajlar"].append({"role": "assistant", "content": yanit_temiz})
    return yanit_temiz


def asama2_meta_senaryo(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client):
    if session["bekleyen_senaryo"] is not None:
        degerlendirme = cevabi_puan_ver(session["bekleyen_senaryo"], kullanici_mesaji, anthropic_client)
        puanlari_guncelle(session, degerlendirme["puanlar"])
        session["cevaplanan_soru_sayisi"] += 1
        session["bekleyen_senaryo"] = None

    if session["cevaplanan_soru_sayisi"] >= META_SENARYO_SAYISI:
        eksik_guclu_hesapla(session)
        session["asama"] = 3
        return asama3_derinleme(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client)

    sunulan_nolar = [s.get("senaryo_no") for s in session["sunulan_senaryolar"]]
    senaryolar    = meta_senaryo_getir(
        session["kritik_yetkinlikler"], sunulan_nolar,
        openai_client, qdrant_client, adet=1,
    )

    if not senaryolar:
        eksik_guclu_hesapla(session)
        session["asama"] = 3
        return asama3_derinleme(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client)

    senaryo = senaryolar[0]
    session["sunulan_senaryolar"].append(senaryo)
    session["bekleyen_senaryo"] = senaryo

    soru_no = session["cevaplanan_soru_sayisi"] + 1
    yanit   = f"**Senaryo {soru_no}/{META_SENARYO_SAYISI}**\n\n{senaryo['senaryo_metni']}\n\n---\n**Bu durumda ilk eylemin ne olurdu ve neden?**"

    session["mesajlar"].append({"role": "assistant", "content": yanit})
    return yanit


def asama3_derinleme(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client):
    if session["bekleyen_senaryo"] is not None:
        degerlendirme = cevabi_puan_ver(session["bekleyen_senaryo"], kullanici_mesaji, anthropic_client)
        puanlari_guncelle(session, degerlendirme["puanlar"])
        session["cevaplanan_soru_sayisi"] += 1
        session["bekleyen_senaryo"] = None

    derinleme_sayisi = session["cevaplanan_soru_sayisi"] - META_SENARYO_SAYISI
    if derinleme_sayisi >= DERINLEME_SAYISI or not session["eksik_yetkinlikler"]:
        session["asama"] = 4
        return asama4_sonuc(session, anthropic_client, openai_client, qdrant_client)

    sunulan_yetkinlikler = [
        s.get("yetkinlik_no") for s in session["sunulan_senaryolar"]
        if s.get("chunk_type") == "makro_senaryo"
    ]
    hedef = next((n for n in session["eksik_yetkinlikler"] if n not in sunulan_yetkinlikler), None)

    if hedef is None:
        session["asama"] = 4
        return asama4_sonuc(session, anthropic_client, openai_client, qdrant_client)

    senaryo = derinleme_senaryo_getir(hedef, qdrant_client)
    if not senaryo:
        session["asama"] = 4
        return asama4_sonuc(session, anthropic_client, openai_client, qdrant_client)

    session["sunulan_senaryolar"].append(senaryo)
    session["bekleyen_senaryo"] = senaryo

    soru_no = derinleme_sayisi + 1
    yanit   = f"**Derinleme Sorusu {soru_no}/{DERINLEME_SAYISI}**\n\n{senaryo['senaryo_metni']}\n\n---\n**Bu durumda ilk eylemin ne olurdu ve neden?**"

    session["mesajlar"].append({"role": "assistant", "content": yanit})
    return yanit


def asama4_sonuc(session, anthropic_client, openai_client, qdrant_client):
    egitim_oneriler = egitim_onerileri_getir(session, openai_client, qdrant_client, adet=5)

    puan_tablosu = "\n".join([
        f"  Yetkinlik {no}: {puan:.1f}/5"
        for no, puan in sorted(session["yetkinlik_puanlari"].items(), key=lambda x: x[1])
    ])

    egitim_metni = _egitim_metni_olustur(egitim_oneriler, adet=5)

    sistem = f"""Sen CareerPick platformunun kariyer danismanisin.
Degerlendirme tamamlandi. Asagidaki verilere dayanarak kisisellestirilmis sonuc raporu yaz.

KULLANICI:
Hedef Kariyer: {session['hedef_kariyer']}
Mevcut Durum: {session['mevcut_durum']}

YETKINLIK PUANLARI:
{puan_tablosu}

GUCLU YETKINLIKLER: {session['guclu_yetkinlikler'][:3]}

ONERILEN EGITIMLER:
{egitim_metni[:1500]}

Rapor yapisi: guclu yonler, ardindan kariyer hedefine katki saglayacak onerilen
egitimler ve neden uygun olduklari, ardindan pratik ilk adimlar, son olarak
motive edici bir kapanis. Kullanicinin zayif veya eksik yetkinliklerini
dogrudan listelemek ya da 'eksiklik' diye adlandirmak yerine, gelisim
alanlarini onerilen egitimler uzerinden dolayli ve yapici bir dille ele al.
Max 400 kelime."""

    yanit = claude_yanit_uret(
        sistem,
        [{"role": "user", "content": "Degerlendirme sonucumu goster."}],
        anthropic_client,
        max_tokens=800,
    )
    session["mesajlar"].append({"role": "assistant", "content": yanit})
    session["tamamlandi"] = True
    return yanit


# ── Orkestrasyon ──────────────────────────────────────────────────────────────────

def mesaj_isle(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client):
    asama = session["asama"]
    if asama == 1:
        return asama1_kullanici_tanima(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client)
    elif asama == 2:
        return asama2_meta_senaryo(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client)
    elif asama == 3:
        return asama3_derinleme(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client)
    elif asama == 4:
        return asama4_sonuc(session, anthropic_client, openai_client, qdrant_client)
    return "Degerlendirme tamamlandi."


# ── HTTP Yardimcilari & Guvenlik ──────────────────────────────────────────────────

def _allowed_origin(origin: str) -> str:
    """Sadece izinli origin'lere CORS izni ver. ALLOWED_ORIGINS bos ise
    cross-origin'e izin verilmez (ayni-domain istekleri zaten CORS gerektirmez)."""
    raw = os.environ.get("ALLOWED_ORIGINS", "")
    allow = [o.strip() for o in raw.split(",") if o.strip()]
    if origin and origin in allow:
        return origin
    return ""


def _rate_limited(ip: str) -> bool:
    now = time.time()
    bucket = [t for t in _RATE_BUCKET.get(ip, []) if now - t < RATE_LIMIT_WIN]
    if len(bucket) >= RATE_LIMIT_MAX:
        _RATE_BUCKET[ip] = bucket
        return True
    bucket.append(now)
    _RATE_BUCKET[ip] = bucket
    return False


class handler(BaseHTTPRequestHandler):
    # log gurultusunu azalt
    def log_message(self, *args):
        pass

    def _send_cors(self):
        origin = self.headers.get("Origin", "")
        allowed = _allowed_origin(origin)
        if allowed:
            self.send_header("Access-Control-Allow-Origin", allowed)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._send_cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def do_POST(self):
        # Rate limit (best-effort)
        ip = (self.headers.get("x-forwarded-for", "") or "anon").split(",")[0].strip()
        if _rate_limited(ip):
            return self._json(429, {"error": "Cok fazla istek. Lutfen biraz bekleyin."})

        # Govdeyi oku (boyut sinirli)
        try:
            length = int(self.headers.get("Content-Length", 0))
        except (TypeError, ValueError):
            length = 0
        if length <= 0 or length > MAX_TOKEN_LEN + MAX_MESSAGE_LEN + 1024:
            return self._json(400, {"error": "Gecersiz istek govdesi."})

        try:
            raw = self.rfile.read(length)
            data = json.loads(raw.decode("utf-8"))
        except Exception:
            return self._json(400, {"error": "Gecersiz JSON."})

        # ADIM 0: Input validasyonu
        message = data.get("message")
        if not isinstance(message, str) or not message.strip():
            return self._json(400, {"error": "Mesaj bos olamaz."})
        message = message.strip()
        if len(message) > MAX_MESSAGE_LEN:
            return self._json(400, {"error": "Mesaj cok uzun."})

        token = data.get("session")
        if token is not None and (not isinstance(token, str) or len(token) > MAX_TOKEN_LEN):
            return self._json(400, {"error": "Gecersiz oturum."})

        # Session coz / olustur
        if token:
            try:
                session = session_decode(token)
            except (InvalidToken, ValueError, KeyError):
                # Token gecersiz/suresi dolmus -> yeni oturum
                session = yeni_session()
        else:
            session = yeni_session()

        # Tamamlanmis oturuma yeni mesaj -> bilgilendir
        if session.get("tamamlandi"):
            return self._json(200, {
                "reply": "Degerlendirmen tamamlandi. Yeni bir degerlendirme icin sayfayi yenileyebilirsin.",
                "session": session_encode(session),
                "asama": session["asama"],
                "done": True,
            })

        # Pipeline
        try:
            anthropic_client, openai_client, qdrant_client = clientlari_baslat()
            reply = mesaj_isle(message, session, anthropic_client, openai_client, qdrant_client)
        except KeyError as e:
            # Eksik ortam degiskeni
            print("[ERROR] Eksik konfigurasyon:", str(e))
            return self._json(500, {"error": "Sunucu yapilandirmasi eksik."})
        except Exception as e:
            print("[ERROR]", repr(e))
            return self._json(503, {"error": "AI servisi su an kullanilamiyor, lutfen tekrar deneyin."})

        try:
            yeni_token = session_encode(session)
        except Exception as e:
            print("[ERROR] session encode:", repr(e))
            return self._json(500, {"error": "Beklenmedik bir hata olustu."})

        return self._json(200, {
            "reply": reply,
            "session": yeni_token,
            "asama": session["asama"],
            "done": bool(session.get("tamamlandi")),
        })

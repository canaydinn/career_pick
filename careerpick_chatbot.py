"""
CareerPick Chatbot — Orkestrasyon Motoru
==========================================
Kullanıcıyla 4 aşamalı bir değerlendirme sohbeti yürütür.

Kurulum:
    pip install anthropic qdrant-client openai

Kullanım:
    python careerpick_chatbot.py

Ortam değişkenleri:
    ANTHROPIC_API_KEY : Claude API anahtarı
    OPENAI_API_KEY    : Embedding için OpenAI anahtarı
    QDRANT_URL        : Qdrant adresi
    QDRANT_API_KEY    : Qdrant Cloud API anahtarı
"""

import os
import json
import re
from openai import OpenAI
from anthropic import Anthropic
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue

COLLECTION_NAME     = "careerpick"
EMBEDDING_MODEL     = "text-embedding-3-large"
CLAUDE_MODEL        = "claude-sonnet-4-6"
META_SENARYO_SAYISI = 5
DERINLEME_SAYISI    = 3
EKSIK_ESIGI         = 3.0


# ── Client Başlatma ───────────────────────────────────────────────────────────

def clientlari_baslat():
    anthropic_client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    openai_client    = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    qdrant_client    = QdrantClient(
        url=os.getenv("QDRANT_URL", "http://localhost:6333"),
        api_key=os.getenv("QDRANT_API_KEY"),
        timeout=60,
        check_compatibility=False,
    )
    return anthropic_client, openai_client, qdrant_client


# ── Session ───────────────────────────────────────────────────────────────────

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
    }


# ── RAG ───────────────────────────────────────────────────────────────────────

def metin_embed_et(metin: str, openai_client: OpenAI) -> list[float]:
    response = openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=[metin],
    )
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


def meta_senaryo_getir(yetkinlik_nolari, sunulan_idler, openai_client, qdrant_client, adet=1):
    vektor = metin_embed_et(
        f"yetkinlik degerlendirme {' '.join(str(n) for n in yetkinlik_nolari[:5])}",
        openai_client
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


def gelisim_onerileri_getir(eksik_nolar, qdrant_client):
    oneriler = []
    for no in eksik_nolar[:5]:
        sonuclar = qdrant_client.query_points(
            collection_name=COLLECTION_NAME,
            query=[0.01] * 3072,
            query_filter=Filter(must=[
                FieldCondition(key="chunk_type",   match=MatchValue(value="yetkinlik_gelisim")),
                FieldCondition(key="yetkinlik_no", match=MatchValue(value=no)),
            ]),
            limit=3,
            with_payload=True,
        )
        oneriler.extend([s.payload for s in sonuclar.points])
    return oneriler


# ── Değerlendirme ─────────────────────────────────────────────────────────────

def cevabi_puan_ver(senaryo, kullanici_cevabi, anthropic_client):
    rubrik = f"""
ANA YETKİNLİK ({senaryo.get('ana_yetkinlik_adi', '')}):
{senaryo.get('ana_yetkinlik_rubrik', '')[:500]}

İKİNCİL 1 ({senaryo.get('ikincil_yetkinlik_1_adi', '')}):
{senaryo.get('ikincil_yetkinlik_1_rubrik', '')[:300]}

İKİNCİL 2 ({senaryo.get('ikincil_yetkinlik_2_adi', '')}):
{senaryo.get('ikincil_yetkinlik_2_rubrik', '')[:300]}
"""
    prompt = f"""Davranışsal yetkinlik değerlendirme uzmanısın.

SENARYO:
{senaryo.get('senaryo_metni', '')[:600]}

KULLANICI CEVABI:
{kullanici_cevabi}

DEĞERLENDİRME RUBRİĞİ:
{rubrik}

Sadece şu JSON formatında yanıt ver:
{{
  "puanlar": {{
    "{senaryo.get('ana_yetkinlik_no', 0)}": <1-5>,
    "{senaryo.get('ikincil_yetkinlik_1_no', 0)}": <1-5>,
    "{senaryo.get('ikincil_yetkinlik_2_no', 0)}": <1-5>
  }},
  "genel_yorum": "<max 2 cümle>"
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
    return {"puanlar": {str(senaryo.get('ana_yetkinlik_no', 0)): 3}, "genel_yorum": "Tamamlandı."}


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


# ── Claude Yanıt ─────────────────────────────────────────────────────────────

def claude_yanit_uret(sistem, mesajlar, anthropic_client, max_tokens=1000):
    yanit = anthropic_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=sistem,
        messages=mesajlar,
    )
    return yanit.content[0].text.strip()


# ── Aşamalar ──────────────────────────────────────────────────────────────────

def asama1_kullanici_tanima(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client):
    sistem = """Sen CareerPick platformunun kariyer rehberi asistanısın.
Görevin kullanıcının hedef kariyerini ve mevcut durumunu (öğrenci/mezun/deneyimli) öğrenmek.

Kurallar:
- Sıcak, samimi ve kısa cevaplar ver
- Bir seferde sadece 1 soru sor
- Kullanıcı hem hedef kariyerini hem mevcut durumunu söylediyse
  yanıtının SONUNA şunu ekle:
  [HAZIR: {"hedef_kariyer": "...", "mevcut_durum": "ogrenci/mezun/deneyimli"}]
- Henüz yeterli bilgi yoksa soru sormaya devam et"""

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
            yanit_temiz += "\n\nHarika! Şimdi sana birkaç durum senaryosu sunacağım. Her senaryoyu okuyup ilk tepkini ve nedenini yaz. Hazır mısın?"
        except json.JSONDecodeError:
            yanit_temiz = yanit
    else:
        yanit_temiz = yanit

    session["mesajlar"].append({"role": "assistant", "content": yanit_temiz})
    return yanit_temiz


def asama2_meta_senaryo(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client):
    # Önceki cevabı değerlendir
    if session["bekleyen_senaryo"] is not None:
        degerlendirme = cevabi_puan_ver(session["bekleyen_senaryo"], kullanici_mesaji, anthropic_client)
        puanlari_guncelle(session, degerlendirme["puanlar"])
        session["cevaplanan_soru_sayisi"] += 1
        session["bekleyen_senaryo"] = None

    # Yeterli soru sorulduysa aşamayı ilerlet
    if session["cevaplanan_soru_sayisi"] >= META_SENARYO_SAYISI:
        eksik_guclu_hesapla(session)
        session["asama"] = 3
        return asama3_derinleme(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client)

    # Yeni senaryo getir
    sunulan_nolar = [s.get("senaryo_no") for s in session["sunulan_senaryolar"]]
    senaryolar    = meta_senaryo_getir(
        session["kritik_yetkinlikler"], sunulan_nolar,
        openai_client, qdrant_client, adet=1
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

    session["mesajlar"].append({"role": "user",      "content": kullanici_mesaji})
    session["mesajlar"].append({"role": "assistant",  "content": yanit})
    return yanit


def asama3_derinleme(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client):
    # Önceki cevabı değerlendir
    if session["bekleyen_senaryo"] is not None:
        degerlendirme = cevabi_puan_ver(session["bekleyen_senaryo"], kullanici_mesaji, anthropic_client)
        puanlari_guncelle(session, degerlendirme["puanlar"])
        session["cevaplanan_soru_sayisi"] += 1
        session["bekleyen_senaryo"] = None

    derinleme_sayisi = session["cevaplanan_soru_sayisi"] - META_SENARYO_SAYISI
    if derinleme_sayisi >= DERINLEME_SAYISI or not session["eksik_yetkinlikler"]:
        session["asama"] = 4
        return asama4_sonuc(session, anthropic_client, qdrant_client)

    # Henüz sorulmamış eksik yetkinlik bul
    sunulan_yetkinlikler = [
        s.get("yetkinlik_no") for s in session["sunulan_senaryolar"]
        if s.get("chunk_type") == "makro_senaryo"
    ]
    hedef = next((n for n in session["eksik_yetkinlikler"] if n not in sunulan_yetkinlikler), None)

    if hedef is None:
        session["asama"] = 4
        return asama4_sonuc(session, anthropic_client, qdrant_client)

    senaryo = derinleme_senaryo_getir(hedef, qdrant_client)
    if not senaryo:
        session["asama"] = 4
        return asama4_sonuc(session, anthropic_client, qdrant_client)

    session["sunulan_senaryolar"].append(senaryo)
    session["bekleyen_senaryo"] = senaryo

    soru_no = derinleme_sayisi + 1
    yanit   = f"**Derinleme Sorusu {soru_no}/{DERINLEME_SAYISI}**\n\n{senaryo['senaryo_metni']}\n\n---\n**Bu durumda ilk eylemin ne olurdu ve neden?**"

    session["mesajlar"].append({"role": "user",      "content": kullanici_mesaji})
    session["mesajlar"].append({"role": "assistant",  "content": yanit})
    return yanit


def asama4_sonuc(session, anthropic_client, qdrant_client):
    oneriler = gelisim_onerileri_getir(session["eksik_yetkinlikler"][:3], qdrant_client)

    puan_tablosu = "\n".join([
        f"  Yetkinlik {no}: {puan:.1f}/5"
        for no, puan in sorted(session["yetkinlik_puanlari"].items(), key=lambda x: x[1])
    ])

    oneri_metni = "\n\n".join([
        f"{o.get('yetkinlik_adi','')} — {o.get('kalib_adi','')}\n"
        f"Eksiklik: {o.get('eksiklik_tanimi','')[:200]}\n"
        f"Önerilen: {', '.join(o.get('egitim_kategorileri',[]))}"
        for o in oneriler[:5]
    ])

    sistem = f"""Sen CareerPick platformunun kariyer danışmanısın.
Değerlendirme tamamlandı. Aşağıdaki verilere dayanarak kişiselleştirilmiş sonuç raporu yaz.

KULLANICI:
- Hedef Kariyer: {session['hedef_kariyer']}
- Mevcut Durum: {session['mevcut_durum']}

YETKİNLİK PUANLARI:
{puan_tablosu}

EKSİK YETKİNLİKLER: {session['eksik_yetkinlikler'][:3]}
GÜÇLÜ YETKİNLİKLER: {session['guclu_yetkinlikler'][:3]}

GELİŞİM ÖNERİLERİ:
{oneri_metni[:1500]}

Rapor: güçlü yönler → 2-3 kritik eksiklik → pratik adımlar → motive edici kapanış. Max 400 kelime."""

    yanit = claude_yanit_uret(
        sistem,
        [{"role": "user", "content": "Değerlendirme sonucumu göster."}],
        anthropic_client,
        max_tokens=800,
    )
    session["mesajlar"].append({"role": "assistant", "content": yanit})
    return yanit


# ── Orkestrasyon ──────────────────────────────────────────────────────────────

def mesaj_isle(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client):
    asama = session["asama"]
    if asama == 1:
        return asama1_kullanici_tanima(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client)
    elif asama == 2:
        return asama2_meta_senaryo(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client)
    elif asama == 3:
        return asama3_derinleme(kullanici_mesaji, session, anthropic_client, openai_client, qdrant_client)
    elif asama == 4:
        return asama4_sonuc(session, anthropic_client, qdrant_client)
    return "Değerlendirme tamamlandı."


# ── Terminal Test ─────────────────────────────────────────────────────────────

def terminal_test():
    print("\n" + "="*60)
    print("  CareerPick Chatbot — Terminal Test Modu")
    print("  Çıkmak için: 'q' yazın")
    print("="*60 + "\n")

    anthropic_client, openai_client, qdrant_client = clientlari_baslat()
    session = yeni_session()

    baslangic = "Merhaba! 👋 Ben CareerPick'in kariyer rehberiyim.\n\nSana özel bir yetkinlik değerlendirmesi yapacak ve hedef kariyerine ulaşmak için kişiselleştirilmiş bir gelişim planı oluşturacağım.\n\n**Hangi kariyere geçmek ya da ilerlemek istiyorsun?**"
    print(f"🤖 CareerPick: {baslangic}\n")
    session["mesajlar"].append({"role": "assistant", "content": baslangic})

    while True:
        try:
            kullanici = input("👤 Sen: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nGörüşmek üzere!")
            break

        if kullanici.lower() == 'q':
            print("\nGörüşmek üzere!")
            break
        if not kullanici:
            continue

        print("\n🤖 CareerPick: ", end="", flush=True)
        yanit = mesaj_isle(kullanici, session, anthropic_client, openai_client, qdrant_client)
        print(yanit)
        print(f"\n[Aşama: {session['asama']} | Cevaplanan: {session['cevaplanan_soru_sayisi']} | Puanlanan: {len(session['yetkinlik_puanlari'])}]\n")

        if session["asama"] == 4 and session["cevaplanan_soru_sayisi"] > 0:
            print("✅ Değerlendirme tamamlandı!")
            break


if __name__ == "__main__":
    terminal_test()

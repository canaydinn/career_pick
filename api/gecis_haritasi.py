"""
kariyer_gecis_haritasi — paylasilan meslek eslestirme
=====================================================
Roadmap (sohbet) ve ilan uyumu (job-match) ayni esik / veri_notu
politikasini kullanir. Fonksiyonu iki yerde kopyalama.
"""

import re

from qdrant_client.models import Filter, FieldCondition, MatchValue

CAREER_COLLECTION = "careerpick"
EMBEDDING_MODEL = "text-embedding-3-large"
# Cosine benzerlik esigi (gevsek tutulmaz — yanlis meslek riski).
# 0.75 pratikte hic eslesme vermedi: birebir meslek adlari ~0.48–0.70,
# gurultu ~0.23. 0.55 gercek meslekleri alir, alakasiz metni disarida birakir.
GECIS_HARITASI_MIN_SCORE = 0.55


def _normalize_tr_text(text):
    t = (text or "").strip().lower()
    for a, b in (
        ("ı", "i"), ("İ", "i"), ("i̇", "i"),
        ("ğ", "g"), ("ü", "u"), ("ş", "s"), ("ö", "o"), ("ç", "c"),
    ):
        t = t.replace(a, b)
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def veri_notu_dusuk_guven(veri_notu):
    """kariyer_gecis_haritasi kayitlarinda dusuk guven sinyali."""
    blob = _normalize_tr_text(veri_notu)
    if not blob:
        return False
    markers = (
        "yetkinlik fallback atamasi",
        "yetkinlikfallback atamasi",
        "iliskisiz giris",
        "tepe seviye",
    )
    return any(m in blob for m in markers)


def format_roller(roller, limit=8):
    """Claude prompt / log icin oncul-ardil liste metni."""
    if not isinstance(roller, list):
        return "(yok)"
    lines = []
    for item in roller:
        if len(lines) >= limit:
            break
        if isinstance(item, dict):
            ad = str(item.get("rol_adi") or "").strip()
            gerekce = str(item.get("gerekce") or "").strip()
            if not ad:
                continue
            lines.append(f"- {ad}" + (f": {gerekce}" if gerekce else ""))
        else:
            ad = str(item or "").strip()
            if ad:
                lines.append(f"- {ad}")
    return "\n".join(lines) if lines else "(yok)"


def _embed(metin, o):
    return o.embeddings.create(model=EMBEDDING_MODEL, input=[metin]).data[0].embedding


def eslestir(hedef, o, q):
    """
    Metni (kariyer_hedefi veya ilan title) embedding ile Qdrant'ta
    en yakin meslek_adi'ye eslestir.

    Skor < GECIS_HARITASI_MIN_SCORE ise None.
    veri_notu dusuk guven ise None (kayit kullanilmaz).

    Politika (veri_notu): Dusuk guven kayitlari ATLA — yanlis meslek
    eslesmesi yaniltici bilgi gosterme riski tasidigi icin guvenilmez
    kayit zorlanmaz.
    """
    hedef = str(hedef or "").strip()
    if not hedef:
        return None

    res = q.query_points(
        collection_name=CAREER_COLLECTION,
        query=_embed(hedef, o),
        query_filter=Filter(must=[
            FieldCondition(
                key="chunk_type",
                match=MatchValue(value="kariyer_gecis_haritasi"),
            )
        ]),
        limit=3,
        with_payload=True,
    )
    points = list(res.points or [])
    if not points:
        return None

    best = None
    best_score = -1.0
    for p in points:
        pl = p.payload or {}
        try:
            score = float(getattr(p, "score", None) or 0.0)
        except (TypeError, ValueError):
            score = 0.0
        meslek = str(pl.get("meslek_adi") or "").strip()
        if not meslek:
            continue
        if score > best_score:
            best_score = score
            best = pl

    if best is None or best_score < GECIS_HARITASI_MIN_SCORE:
        print(
            f"[GECIS] eslesme yok "
            f"(best_score={best_score:.3f}, esik={GECIS_HARITASI_MIN_SCORE})"
        )
        return None

    veri_notu = str(best.get("veri_notu") or "")
    if veri_notu_dusuk_guven(veri_notu):
        # Politika: dusuk guven kaydi kullanma → caller ek bolumu gostermez.
        print(
            f"[GECIS] dusuk guven atlandi "
            f"meslek={best.get('meslek_adi')!r} veri_notu={veri_notu[:120]!r}"
        )
        return None

    print(
        f"[GECIS] eslesti meslek={best.get('meslek_adi')!r} "
        f"score={best_score:.3f}"
    )
    return {
        "meslek_adi": str(best.get("meslek_adi") or "").strip(),
        "aile": str(best.get("aile") or "").strip(),
        "alt_fonksiyon": str(best.get("alt_fonksiyon") or "").strip(),
        "kariyer_seviyesi": str(best.get("kariyer_seviyesi") or "").strip(),
        "egitim": str(best.get("egitim") or "").strip(),
        "sektor": str(best.get("sektor") or "").strip(),
        "veri_notu": veri_notu,
        "oncul_roller": best.get("oncul_roller") if isinstance(best.get("oncul_roller"), list) else [],
        "ardil_roller": best.get("ardil_roller") if isinstance(best.get("ardil_roller"), list) else [],
        "yatay_gecisler": best.get("yatay_gecisler"),
        "score": best_score,
    }

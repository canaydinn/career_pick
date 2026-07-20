# Career Pick v0.13.0 — Senaryolar hedef mesleğe sıkı

Kariyer Sohbeti senaryo seçimi artık meslek/sektör odaklı; Qdrant koleksiyonu değişmedi.

## Ne geldi?

- Meslek hop: `kariyer_hedefi` + `hedef_sektor` öncelikli; top-3 adaydan örtüşen seçim
- Senaryo sorgusu: meslek + yetkinlik **adları** (ham ID önde değil)
- Over-fetch + re-rank: yetkinlik üyeliği, sektör keyword, çeşitlilik
- Cascade: meslek-biased → yetkinlik → legacy; `match_quality` / `fallback`
- UI: eşleşen meslek chip’i

## Tag önerisi

**Tag:** `v0.13.0`  
**Title:** `v0.13.0 — Senaryo meslek sıkılaştırma`

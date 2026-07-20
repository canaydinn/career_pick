# Career Pick v0.13.0 — Senaryolar hedef mesleğe sıkı + eğitim sektör ağırlığı

Kariyer Sohbeti senaryo seçimi meslek/sektör odaklı; eğitim aramasında sektör sinyali korunur. Qdrant koleksiyonu değişmedi.

## Ne geldi?

### Senaryolar
- Meslek hop: `kariyer_hedefi` + `hedef_sektor`; top-3 aday
- Sorgu rewrite + over-fetch/re-rank + cascade
- UI: eşleşen meslek chip’i

### Eğitim önerisi (`oner`)
- Birincil arama: sektör + hedef önde
- Ayrı sektör araması (turizm/otel kaybolmasın)
- Genel yöneticilik araması yalnızca yedek; re-rank sektör eşleşenleri üste alır
- Claude: listede sektör eğitimi varsa genel liderlikle doldurma

## Tag önerisi

**Tag:** `v0.13.0`  
**Title:** `v0.13.0 — Meslek senaryo + eğitim sektör ağırlığı`

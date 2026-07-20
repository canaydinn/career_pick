# Career Pick v0.7.0 — Sektör mentor notları

Sohbetteki `hedef_sektor` yanıtına göre 3–5 dakikalık kısa mentör kartları. Blog değil; ürün içi rehberlik. Qdrant / eğitim öneri mantığına dokunulmaz.

## Ne geldi?

- `sector_notes` tablosu + herkese okuma RLS + ~20 seed not (5 sektör + genel)
- `hedef_sektor` → `sector_key` eşleştirme (`turizm`, `yazilim`, `insaat`, `finans`, `saglik`; yoksa `genel`)
- Profil: **Sektör notların** (eğitim / mikro pratiklerden görsel olarak ayrı)
- Sohbet sonuç: öne çıkan not + **Tümünü gör**
- CTA: `micro_task` | `chat` | `training`
- Opsiyonel Claude tek cümle kişiselleştirme (`personalize_sector_note`) — sistem cümle olmadan da çalışır
- Migrasyon öncesi fallback: `sector-notes-data.js`

## Kurulum

1. Supabase → `20260720120000_sector_notes.sql`
2. Deploy

## Tag önerisi

**Tag:** `v0.7.0`  
**Title:** `v0.7.0 — Sektör mentor notları`

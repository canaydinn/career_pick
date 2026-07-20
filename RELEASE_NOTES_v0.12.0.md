# Career Pick v0.12.0 — Admin kabuğu + öneri kalitesi

İlk admin paneli: sekmeli kabuk; yalnızca **Öneri kalitesi** sekmesi dolu. Qdrant CRUD / fiyat editörü / sohbet metni okuma yok.

## Ne geldi?

- `profiles.is_admin` + koruma tetikleyicisi
- `recommended_trainings.session_id`, `is_placeholder`
- `recommendation_events` (sohbet recommend gözlemi)
- `/admin.html` — Google giriş + `is_admin` zorunlu (istemci + API)
- Dört bölüm: boş öneri, sektör notu boşluğu, ilan uyumu zayıf skor, yarı boş öneri
- Yer tutucu sekmeler: Abonelik, Kota, Kullanıcı ara, Sohbet hunisi

## Kurulum

1. Supabase → `20260720250000_admin_recommendation_quality.sql`
2. `update profiles set is_admin = true where email = '...'`
3. Deploy — `/admin.html`

## Tag önerisi

**Tag:** `v0.12.0`  
**Title:** `v0.12.0 — Admin öneri kalitesi`

# Supabase + Google OAuth kurulum

## 1. Supabase proje

1. [supabase.com](https://supabase.com) üzerinde proje oluştur.
2. SQL Editor’da `migrations/20260718120000_init_user_tables.sql` dosyasını çalıştır.
3. **Project Settings → API** içinden:
   - `Project URL` → `SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY`

## 2. Google Cloud OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. **OAuth 2.0 Client ID** (Web application) oluştur.
3. Authorized redirect URI olarak Supabase’in verdiği callback’i ekle:
   - `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
4. Client ID ve Client Secret’i kopyala.

## 3. Supabase Auth ayarları

1. Authentication → Providers → **Google** → Enable.
2. Client ID / Secret yapıştır.
3. Authentication → URL Configuration:
   - Site URL: `https://careerpick.vercel.app` (veya lokal `http://localhost:8000`)
   - Redirect URLs:
     - `https://careerpick.vercel.app/auth-callback.html`
     - `http://localhost:8000/auth-callback.html`

## 4. Vercel ortam değişkenleri

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

Lokal için `.env.local` içine aynı anahtarları yaz; `scripts/dev_server.py` `/api/public-config` ile okur.

## 5. Doğrulama

1. `kariyer sohbet.html` → **Gmail ile giriş**
2. Sohbeti bitir → Supabase Table Editor’da `user_answers`, `recommended_trainings`, `user_insights`, `roadmap_steps` satırları
3. `profil.html` → yol haritası zaman çizelgesi, eğitimler ve progress bar

## 6. Öğrenme planı migration (v0.2+)

SQL Editor’da ayrıca çalıştır:

`migrations/20260718220000_learning_plan.sql`

Bu dosya ekler:
- `recommended_trainings.link`, `started_at`, `completed_at`, `last_reminded_at`
- `profiles.email_reminders_opt_in` (varsayılan `false`)

## 6b. Yol haritası migration (v0.3+)

SQL Editor’da çalıştır:

`migrations/20260718230000_roadmap_steps.sql`

Bu dosya ekler:
- `roadmap_steps` (step_order, title, description, status, archived)
- `recommended_trainings.step_id` (nullable FK)

Sohbet bitince Claude (veya fallback) 3–5 adım üretir; profilde dikey zaman çizelgesi olarak görünür.

## 6c. Yetkinlik snapshot migration (v0.4+)

SQL Editor’da çalıştır:

`migrations/20260718240000_competency_snapshots.sql`

Bu dosya ekler:
- `competency_snapshots` (user_id, session_id, created_at)
- `competency_scores` (snapshot_id, yetkinlik_adi normalize, puan, seviye, yorum)

İkinci sohbette sonuç ekranında “önceki vs şimdi” paneli; profilde kısa özet. `user_insights` değişmez.

## 6d. Mikro görevler migration (v0.5+)

SQL Editor’da çalıştır:

`migrations/20260718250000_micro_tasks.sql`

Profilde “Bu haftanın pratikleri”; sohbet bitince / Pazartesi cron ile 2–4 kısa pratik.
Önceki haftalar silinmez (`week_start` ile arşiv).

## 6e. İlan uyumu migration (v0.6+)

SQL Editor’da çalıştır:

`migrations/20260719010000_job_matches.sql`

- `job_matches` (url, title, fit_score, gaps_json)
- `recommended_trainings.source` (`sohbet` | `job_match`)

Sayfa: `/ilan-uyumu.html` — URL veya metin yapıştır → yaklaşık uyum + eğitimler.

## 6f. Sektör mentor notları (v0.7+)

SQL Editor’da çalıştır:

`migrations/20260720120000_sector_notes.sql`

- `sector_notes` tablosu (herkese okuma RLS; istemci yazamaz)
- Seed: turizm, yazilim, insaat, finans, saglik + genel (~20 kısa not)
- Profil: **Sektör notların**; sohbet sonuç: öne çıkan not + tümünü gör
- Migrasyon öncesi istemci fallback: `sector-notes-data.js`

## 6g. Sohbet draft — kaldığı yerden devam (v0.8+)

SQL Editor’da çalıştır:

`migrations/20260720210000_chat_drafts.sql`

- `chat_drafts` (answers, attempts, **scenario_questions_json**, status)
- Kullanıcı başına tek `in_progress` (partial unique index)
- Sohbet banner: Devam et / Baştan başla; profil linki `?resume=1`
- `user_answers` audit olarak kalır; UI hydrate kaynağı draft’tır

## 6h. Haftalık check-in (v0.9+)

SQL Editor’da çalıştır:

`migrations/20260720220000_weekly_checkins.sql`

- `weekly_checkins` (`week_start` = mikro görevlerle aynı Pazartesi)
- Profil: **Haftalık check-in** (`#check-in`) — 1–2 soru, opsiyonel Claude yansıma
- Hatırlatma mailine “Check-in’i tamamla” CTA (opt-in)

## 6i. Paylaşılabilir özet kartı (v0.10+)

1. Aşama (DB gerekmez): profil + sohbet sonucundan **Özet kartı** → PNG indir + LinkedIn metni kopyala (`share-card.js`).

2. Aşama (public link): SQL Editor’da çalıştır:

`migrations/20260720230000_share_cards.sql`

- `share_cards` (token, payload_json, is_public)
- Sayfa: `/ozet.html?t=…` (`noindex`)

## 7. Haftalık e-posta hatırlatması (opsiyonel)

Vercel env:

```
CRON_SECRET=uzun-rastgele-string
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # service_role — asla frontend’e koyma
RESEND_API_KEY=re_...
RESEND_FROM=Career Pick <onboarding@resend.dev>
APP_BASE_URL=https://careerpick.vercel.app
```

Cron: her Pazartesi 09:00 UTC → `GET/POST /api/reminders`  
Kullanıcı profilde **Haftalık e-posta hatırlatması**nı açmadan mail gitmez.

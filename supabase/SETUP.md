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
2. Sohbeti bitir → Supabase Table Editor’da `user_answers`, `recommended_trainings`, `user_insights` satırları
3. `profil.html` → eğitimler ve progress bar

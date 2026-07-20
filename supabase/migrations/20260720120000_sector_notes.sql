-- CareerPick — Sektor mentor notlari (kisa rehber kartlari)
-- Herkese okuma; istemci yazamaz.

create table if not exists public.sector_notes (
  id uuid primary key default gen_random_uuid(),
  sector_key text not null,
  slug text not null,
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  "order" int not null default 1,
  locale text not null default 'tr',
  cta_type text not null default 'chat'
    check (cta_type in ('micro_task', 'chat', 'training')),
  unique (sector_key, slug, locale)
);

comment on table public.sector_notes is 'Urun ici kisa sektor mentor notlari (blog degil)';
comment on column public.sector_notes.sector_key is 'Normalize: turizm, yazilim, insaat, finans, saglik, genel';

create index if not exists sector_notes_sector_locale_idx
  on public.sector_notes (sector_key, locale, "order");

alter table public.sector_notes enable row level security;

drop policy if exists "sector_notes_select_all" on public.sector_notes;
create policy "sector_notes_select_all"
  on public.sector_notes for select
  using (true);

grant select on public.sector_notes to anon, authenticated;

-- Seed (idempotent: conflict ignore)
insert into public.sector_notes (sector_key, slug, title, body, tags, "order", locale, cta_type)
values
-- TURIZM
('turizm', 'turizm-rol-haritasi', 'Turizmde tipik rol basamakları',
 'Otel ve turizmde ilerleme çoğu zaman resepsiyon / misafir ilişkileri, shift liderliği ve operasyon yönetimine doğru akar. Unvanlar işletmeye göre değişir; asıl sinyal, vardiya sorumluluğu ve şikâyet yönetiminde güven kazanmaktır. İlk yıllarda “her işe koşmak” normaldir; bunu not alıp hangi görevde güçlendiğini yaz. Liderlik iddiası, tek başına unvanla değil; ekibi koordine ettiğin somut örneklerle güçlenir. Bu not ortalama bir yol haritasıdır; işletme tipine göre (resort, city hotel, F&B) tempo değişir.',
 array['unvan','rota'], 1, 'tr', 'chat'),
('turizm', 'turizm-ilk-90-gun', 'İlk 90 günde neye odaklanmalısın?',
 'İlk ayda PMS / rezervasyon akışı, check-in ve sık şikâyet senaryolarını öğren. İkinci ayda bir üstünün yanında vardiya devri ve ekip iletişiminde görünür ol. Üçüncü ayda bir süreci (ör. late checkout veya şikâyet kaydı) daha net ve hızlı hale getirdiğini gösterebilirsin. Günlük tut: ne oldu, ne yaptın, sonuç neydi. İngilizce pratik günlük misafir cümleleriyle ilerler; uzun dil kursunu beklemek zorunda değilsin. Bu bir kontrol listesi önerisidir; otelin prosedürleri her zaman önceliklidir.',
 array['ilk-90-gun','pratik'], 2, 'tr', 'micro_task'),
('turizm', 'turizm-tuzak', 'Sık görülen tuzak: “Sadece dil yeter”',
 'Turizmde dil kritik bir kapıdır ama tek başına yönetici sinyaline dönüşmez. Kriz anında sakin kalmak, ekiple net konuşmak ve kaydı düzgün tutmak en az dil kadar önemlidir. Sadece kurs biriktirmek yerine, gerçek bir misafir etkileşimini sonra 5 cümleyle özetlemeyi dene. Liderlik algısı, “ben yaptım” değil “ekibi nasıl hizaladım” sorusuna bağlıdır. Eğitimlerini operasyon pratiğiyle eşleştir; CareerPick pratikleri buna yardımcı olur.',
 array['tuzak','gelisim'], 3, 'tr', 'training'),
('turizm', 'turizm-sonraki-adim', 'Bu hafta atabileceğin net adım',
 'Bu hafta bir vardiyada gördüğün bir aksaklığı tek cümleyle tanımla ve bir iyileştirme fikri yaz. Mümkünse bir ekip arkadaşına nazikçe sor: “Bunu daha iyi nasıl yaparız?” Cevabı not et. Bu küçük pratik, hem iletişim hem önceliklendirme sinyalini güçlendirir. Uzun bir sertifika beklemeden sektör dilinde görünür ilerleme sağlar. Hazırsan Kariyer Sohbeti veya haftalık pratiklerden birini aç.',
 array['eylem','cta'], 4, 'tr', 'micro_task'),

-- YAZILIM
('yazilim', 'yazilim-rol-haritasi', 'Yazılımda tipik ilerleme sinyalleri',
 'Junior’dan mid’e geçiş çoğu zaman “ticket bitirdim”den “bağımsız tasarlayıp teslim ettim”e kayar. Lead / senior sinyali ise başkalarının işini kolaylaştırmak, net review vermek ve belirsizliği azaltmaktır. Unvan şirket kültürüne göre değişir; portföy ve görünür katkılar daha güvenilir göstergedir. Küçük ama canlı bir proje, on tutorial’dan daha güçlüdür. Bu özet genel bir çerçevedir; ürün / veri / altyapı yolları farklı tempolar izler.',
 array['unvan','rota'], 1, 'tr', 'chat'),
('yazilim', 'yazilim-ilk-90-gun', 'İlk 90 günde neye odaklanmalısın?',
 'İlk haftalarda repo düzeni, PR süreci ve “nasıl sorulur?” kültürünü öğren. Sonra küçük bir ticket’ı uçtan uca sahiplen: anla, uygula, test et, anlat. Üçüncü ayda bir dokümantasyon veya onboarding notu bırakmak, ekibe bıraktığın izi gösterir. Günlük commit sayısı değil, net iletişim ve geri bildirim alma cesareti ilerletir. Tutorial tüketimini sınırla; öğrendiklerini kısa bir demoda anlat. Takım kuralları her zaman senin varsayımlarından önce gelir.',
 array['ilk-90-gun','pratik'], 2, 'tr', 'micro_task'),
('yazilim', 'yazilim-tuzak', 'Sık görülen tuzak: “Sadece kurs yeter”',
 'Kurslar kapı açar ama iş sinyali, gerçek problem çözme ve işbirliğidir. Sonsuz tutorial döngüsü, portföy boşluğunu gizleyebilir. Bir özelliği bozup düzeltmek, bir bug’ı izole etmek veya bir PR’da net soru sormak daha güçlü kanıttır. Kariyer Pick eğitimlerini seçerken “bunu hangi küçük projede kullanacağım?” sorusunu yanına yaz. Mentör notu budur: öğren → uygula → anlat.',
 array['tuzak','gelisim'], 3, 'tr', 'training'),
('yazilim', 'yazilim-sonraki-adim', 'Bu hafta atabileceğin net adım',
 'Bu hafta 60–90 dakikalık bir mini görev seç: küçük bir CLI, bir API endpoint veya bir UI parçası. Bitince README’ye “ne yaptım / nasıl çalıştırılır / ne öğrendim” yaz. Mümkünse birine 3 dakikada anlat. Bu pratik, hem analitik hem iletişim alanına dokunur. Sonra profilindeki pratiklere veya ilgili bir eğitime geçebilirsin.',
 array['eylem','cta'], 4, 'tr', 'micro_task'),

-- INSAAT
('insaat', 'insaat-rol-haritasi', 'İnşaatta saha ve ofis yolları',
 'İnşaat kariyerinde saha mühendisliği, planlama / kontrol ve proje yönetimi sık görülen hatlardır. İlerleme sinyali çoğu zaman iş programı, taşeron koordinasyonu ve güvenlik bilincinde görünür. Unvanlar firmaya göre değişir; “şantiyede neyi sahiplendin?” sorusu daha nettir. Otel, konut veya endüstriyel işler farklı ritim ister. Bu not genel bir çerçevedir; lisans / yetkinlik gereksinimleri pozisyona göre değişir.',
 array['unvan','rota'], 1, 'tr', 'chat'),
('insaat', 'insaat-ilk-90-gun', 'İlk 90 günde neye odaklanmalısın?',
 'İlk ayda şantiye dilini, güvenlik kurallarını ve raporlama formatını öğren. İkinci ayda bir iş kaleminin takibini üstlen: gecikme nedeni, malzeme, iş gücü. Üçüncü ayda bir koordinasyon örneği yaz (taşeron / ofis / saha). Not tutmak, hem öğrenmeyi hem mülakat hikâyesini güçlendirir. Yazılım araçları (planlama, CAD vb.) pozisyona göre değişir; önce ekibin kullandığını öğren. Prosedürler her zaman kişisel tercihten önce gelir.',
 array['ilk-90-gun','pratik'], 2, 'tr', 'micro_task'),
('insaat', 'insaat-tuzak', 'Sık görülen tuzak: Sadece teknik bilgi',
 'Teknik çizim bilgisi kritiktir ama proje ortamında iletişim ve önceliklendirme olmadan tıkanırsın. “Ben haklıyım” yerine “risk ne, seçenekler ne?” dili ilerletir. Taşeron ilişkisi bir güç gösterisi değil, net beklenti ve takip işidir. Eğitimlerini saha pratiğiyle birleştir; CareerPick mikro pratikleri buna uygun kısa denemeler sunar.',
 array['tuzak','gelisim'], 3, 'tr', 'training'),
('insaat', 'insaat-sonraki-adim', 'Bu hafta atabileceğin net adım',
 'Bu hafta bir gecikme veya koordinasyon sorununu tek paragrafta yaz: durum, etki, önerdiğin sonraki adım. Mümkünse bir ekip üyesine sorup notunu güncelle. Bu, hem liderlik hem problem çözme sinyalidir. Ardından ilgili bir pratik veya eğitime geçebilirsin.',
 array['eylem','cta'], 4, 'tr', 'micro_task'),

-- FINANS
('finans', 'finans-rol-haritasi', 'Finansta sık görülen yollar',
 'Finans ve muhasebede operasyon (kayıt, rapor), analitik (bütçe, maliyet) ve kontrol / denetim hatları yaygındır. İlerleme sinyali çoğu zaman hatasız teslim, deadline disiplini ve iş birimi dilini anlama olarak görünür. Unvanlar kuruma göre değişir; “hangi raporu sahiplendin?” daha somuttur. Bu genel bir çerçevedir; düzenleyici gereksinimler role göre değişir.',
 array['unvan','rota'], 1, 'tr', 'chat'),
('finans', 'finans-ilk-90-gun', 'İlk 90 günde neye odaklanmalısın?',
 'İlk ayda süreçleri ve kontrol noktalarını öğren; neden bu kontrol var diye sor. İkinci ayda tekrarlayan bir raporu hızlandır veya netleştir. Üçüncü ayda bir anomalinin nasıl yakalandığını yaz. Excel / ERP bilgisi araçtır; asıl değer, sayıyı iş kararına bağlamaktır. Gizlilik ve yetki kurallarına sıkı uy. Kurum prosedürü her zaman önceliklidir.',
 array['ilk-90-gun','pratik'], 2, 'tr', 'micro_task'),
('finans', 'finans-tuzak', 'Sık görülen tuzak: Sadece formül bilmek',
 'Formül bilmek işe giriş kapısı olabilir ama sürdürülebilir sinyal, doğruluk ve iletişimdir. Raporu “attım” demek yetmez; alıcının neye bakacağını bilmek gerekir. Belirsiz bir rakamı sormak zayıflık değil, kontrol kültürüdür. Eğitimleri gerçek bir tablo / senaryo pratiğiyle eşleştir.',
 array['tuzak','gelisim'], 3, 'tr', 'training'),
('finans', 'finans-sonraki-adim', 'Bu hafta atabileceğin net adım',
 'Bu hafta kullandığın bir raporu 5 satırda açıkla: amaç, kaynak, risk, alıcı, iyileştirme. Birine anlatmayı dene. Bu pratik analitik ve iletişim alanına dokunur. Sonra haftalık pratiklere veya ilgili eğitime geçebilirsin.',
 array['eylem','cta'], 4, 'tr', 'micro_task'),

-- SAGLIK
('saglik', 'saglik-rol-haritasi', 'Sağlık sektöründe rehberlik notu',
 'Sağlıkta klinik ve idari yollar ayrışır; lisans / yetki sınırları kritiktir. İlerleme çoğu zaman protokole uyum, ekip iletişimi ve hasta / danışan güvenliği etrafında anlatılır. Unvanlar kuruma göre değişir. Bu not genel bilgilendirmedir; tıbbi tavsiye veya yetki vaadi değildir. Kendi unvanının yasal çerçevesini her zaman doğrula.',
 array['unvan','rota'], 1, 'tr', 'chat'),
('saglik', 'saglik-ilk-90-gun', 'İlk 90 günde neye odaklanmalısın?',
 'İlk ayda protokoller, kayıt ve iletişim kanallarını öğren. İkinci ayda bir ekip rutininin parçası ol (devir, toplantı, takip). Üçüncü ayda bir olayı (gecikme, iletişim kopukluğu) öğrenme notuna dönüştür. Empati ile sınır koyma birlikte yürür. Bu öneriler geneldir; kurum politikası ve yasal çerçeve önceliklidir.',
 array['ilk-90-gun','pratik'], 2, 'tr', 'micro_task'),
('saglik', 'saglik-tuzak', 'Sık görülen tuzak: Tükenmişlik ve sessizlik',
 'Yoğun tempoda “idare ederim” demek görünmez borç biriktirir. Erken geri bildirim istemek ve net öncelik sormak uzun vadede daha sağlıklıdır. Eğitim seçerken sürdürülebilir tempo ve iletişim becerilerini de hesaba kat. Bu bir klinik öneri değil; kariyer sürdürülebilirliği notudur.',
 array['tuzak','gelisim'], 3, 'tr', 'training'),
('saglik', 'saglik-sonraki-adim', 'Bu hafta atabileceğin net adım',
 'Bu hafta bir zor iletişimi (ekip veya süreç) 5 cümleyle yaz: ne oldu, ne denedin, ne öğrendin. Mümkünse bir mentöre / güvendiğin birine sor. Ardından CareerPick pratiklerinden birini seç. Tıbbi kararlar için her zaman yetkili profesyonellere danış.',
 array['eylem','cta'], 4, 'tr', 'micro_task'),

-- GENEL
('genel', 'genel-net-hedef', 'Belirsiz hedefi netleştirmek',
 '“İyi bir iş istiyorum” yerine “hangi sorunları çözmek istiyorum / hangi ortamda?” diye sor. Bir cümlelik hedef, eğitim ve ilan seçimini kolaylaştırır. Hedef değişebilir; önemli olan şu anki varsayımlarını yazmak. CareerPick sohbeti bunu yapılandırmana yardım eder. Bu genel bir çerçevedir; garanti sonuç vaat etmez.',
 array['hedef','baslangic'], 1, 'tr', 'chat'),
('genel', 'genel-kanit', 'Kanıt üret: öğren → uygula → anlat',
 'Kurs bitirmek tek başına sinyal değildir. Küçük bir uygulama ve 3 cümlelik özet, profilini güçlendirir. Haftalık mikro pratikler bu alışkanlığı düşük eforla kurar. Eğitimlerini “neden bu?” gerekçesiyle seç. İlerleme yaklaşık bir gelişim sinyalidir; bilimsel ölçüm iddiası yoktur.',
 array['pratik','gelisim'], 2, 'tr', 'micro_task'),
('genel', 'genel-ilan', 'İlan okumayı öğren',
 'İlanlardaki zorunlu maddeleri ayır; hepsini aynı anda kapatmaya çalışma. Önce 2–3 boşluğu seç ve pratik / eğitim bağla. CareerPick ilan uyumu aracı buna yardımcı olabilir. Uyum skoru yaklaşık bir sinyaldir; işe alım garantisi değildir.',
 array['ilan','eylem'], 3, 'tr', 'training')
on conflict (sector_key, slug, locale) do nothing;

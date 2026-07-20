/* Sektor mentor notlari — istemci fallback (Supabase bos / migrasyon oncesi) */
(function (global) {
  "use strict";

  var NOTES = [
    { sector_key: "turizm", slug: "turizm-rol-haritasi", title: "Turizmde tipik rol basamakları", order: 1, locale: "tr", cta_type: "chat", tags: ["unvan", "rota"],
      body: "Otel ve turizmde ilerleme çoğu zaman resepsiyon / misafir ilişkileri, shift liderliği ve operasyon yönetimine doğru akar. Unvanlar işletmeye göre değişir; asıl sinyal, vardiya sorumluluğu ve şikâyet yönetiminde güven kazanmaktır. İlk yıllarda “her işe koşmak” normaldir; bunu not alıp hangi görevde güçlendiğini yaz. Liderlik iddiası, tek başına unvanla değil; ekibi koordine ettiğin somut örneklerle güçlenir. Bu not ortalama bir yol haritasıdır; işletme tipine göre tempo değişir." },
    { sector_key: "turizm", slug: "turizm-ilk-90-gun", title: "İlk 90 günde neye odaklanmalısın?", order: 2, locale: "tr", cta_type: "micro_task", tags: ["ilk-90-gun"],
      body: "İlk ayda PMS / rezervasyon akışı, check-in ve sık şikâyet senaryolarını öğren. İkinci ayda bir üstünün yanında vardiya devri ve ekip iletişiminde görünür ol. Üçüncü ayda bir süreci daha net ve hızlı hale getirdiğini gösterebilirsin. Günlük tut: ne oldu, ne yaptın, sonuç neydi. İngilizce pratik günlük misafir cümleleriyle ilerler. Bu bir kontrol listesi önerisidir; otelin prosedürleri her zaman önceliklidir." },
    { sector_key: "turizm", slug: "turizm-tuzak", title: "Sık görülen tuzak: “Sadece dil yeter”", order: 3, locale: "tr", cta_type: "training", tags: ["tuzak"],
      body: "Turizmde dil kritik bir kapıdır ama tek başına yönetici sinyaline dönüşmez. Kriz anında sakin kalmak, ekiple net konuşmak ve kaydı düzgün tutmak en az dil kadar önemlidir. Sadece kurs biriktirmek yerine, gerçek bir misafir etkileşimini sonra 5 cümleyle özetlemeyi dene. Eğitimlerini operasyon pratiğiyle eşleştir; CareerPick pratikleri buna yardımcı olur." },
    { sector_key: "turizm", slug: "turizm-sonraki-adim", title: "Bu hafta atabileceğin net adım", order: 4, locale: "tr", cta_type: "micro_task", tags: ["eylem"],
      body: "Bu hafta bir vardiyada gördüğün bir aksaklığı tek cümleyle tanımla ve bir iyileştirme fikri yaz. Mümkünse bir ekip arkadaşına nazikçe sor: “Bunu daha iyi nasıl yaparız?” Cevabı not et. Bu küçük pratik, hem iletişim hem önceliklendirme sinyalini güçlendirir. Hazırsan Kariyer Sohbeti veya haftalık pratiklerden birini aç." },

    { sector_key: "yazilim", slug: "yazilim-rol-haritasi", title: "Yazılımda tipik ilerleme sinyalleri", order: 1, locale: "tr", cta_type: "chat", tags: ["unvan", "rota"],
      body: "Junior’dan mid’e geçiş çoğu zaman “ticket bitirdim”den “bağımsız tasarlayıp teslim ettim”e kayar. Lead / senior sinyali ise başkalarının işini kolaylaştırmak, net review vermek ve belirsizliği azaltmaktır. Unvan şirket kültürüne göre değişir; portföy ve görünür katkılar daha güvenilir göstergedir. Küçük ama canlı bir proje, on tutorial’dan daha güçlüdür. Bu özet genel bir çerçevedir." },
    { sector_key: "yazilim", slug: "yazilim-ilk-90-gun", title: "İlk 90 günde neye odaklanmalısın?", order: 2, locale: "tr", cta_type: "micro_task", tags: ["ilk-90-gun"],
      body: "İlk haftalarda repo düzeni, PR süreci ve “nasıl sorulur?” kültürünü öğren. Sonra küçük bir ticket’ı uçtan uca sahiplen: anla, uygula, test et, anlat. Üçüncü ayda bir dokümantasyon veya onboarding notu bırakmak, ekibe bıraktığın izi gösterir. Tutorial tüketimini sınırla; öğrendiklerini kısa bir demoda anlat. Takım kuralları her zaman senin varsayımlarından önce gelir." },
    { sector_key: "yazilim", slug: "yazilim-tuzak", title: "Sık görülen tuzak: “Sadece kurs yeter”", order: 3, locale: "tr", cta_type: "training", tags: ["tuzak"],
      body: "Kurslar kapı açar ama iş sinyali, gerçek problem çözme ve işbirliğidir. Sonsuz tutorial döngüsü, portföy boşluğunu gizleyebilir. Bir özelliği bozup düzeltmek veya bir PR’da net soru sormak daha güçlü kanıttır. Kariyer Pick eğitimlerini seçerken “bunu hangi küçük projede kullanacağım?” sorusunu yanına yaz. Mentör notu: öğren → uygula → anlat." },
    { sector_key: "yazilim", slug: "yazilim-sonraki-adim", title: "Bu hafta atabileceğin net adım", order: 4, locale: "tr", cta_type: "micro_task", tags: ["eylem"],
      body: "Bu hafta 60–90 dakikalık bir mini görev seç: küçük bir CLI, bir API endpoint veya bir UI parçası. Bitince README’ye “ne yaptım / nasıl çalıştırılır / ne öğrendim” yaz. Mümkünse birine 3 dakikada anlat. Sonra profilindeki pratiklere veya ilgili bir eğitime geçebilirsin." },

    { sector_key: "insaat", slug: "insaat-rol-haritasi", title: "İnşaatta saha ve ofis yolları", order: 1, locale: "tr", cta_type: "chat", tags: ["unvan", "rota"],
      body: "İnşaat kariyerinde saha mühendisliği, planlama / kontrol ve proje yönetimi sık görülen hatlardır. İlerleme sinyali çoğu zaman iş programı, taşeron koordinasyonu ve güvenlik bilincinde görünür. Unvanlar firmaya göre değişir; “şantiyede neyi sahiplendin?” sorusu daha nettir. Bu not genel bir çerçevedir; lisans gereksinimleri pozisyona göre değişir." },
    { sector_key: "insaat", slug: "insaat-ilk-90-gun", title: "İlk 90 günde neye odaklanmalısın?", order: 2, locale: "tr", cta_type: "micro_task", tags: ["ilk-90-gun"],
      body: "İlk ayda şantiye dilini, güvenlik kurallarını ve raporlama formatını öğren. İkinci ayda bir iş kaleminin takibini üstlen: gecikme nedeni, malzeme, iş gücü. Üçüncü ayda bir koordinasyon örneği yaz. Not tutmak, hem öğrenmeyi hem mülakat hikâyesini güçlendirir. Prosedürler her zaman kişisel tercihten önce gelir." },
    { sector_key: "insaat", slug: "insaat-tuzak", title: "Sık görülen tuzak: Sadece teknik bilgi", order: 3, locale: "tr", cta_type: "training", tags: ["tuzak"],
      body: "Teknik çizim bilgisi kritiktir ama proje ortamında iletişim ve önceliklendirme olmadan tıkanırsın. “Ben haklıyım” yerine “risk ne, seçenekler ne?” dili ilerletir. Taşeron ilişkisi bir güç gösterisi değil, net beklenti ve takip işidir. Eğitimlerini saha pratiğiyle birleştir." },
    { sector_key: "insaat", slug: "insaat-sonraki-adim", title: "Bu hafta atabileceğin net adım", order: 4, locale: "tr", cta_type: "micro_task", tags: ["eylem"],
      body: "Bu hafta bir gecikme veya koordinasyon sorununu tek paragrafta yaz: durum, etki, önerdiğin sonraki adım. Mümkünse bir ekip üyesine sorup notunu güncelle. Bu, hem liderlik hem problem çözme sinyalidir. Ardından ilgili bir pratik veya eğitime geçebilirsin." },

    { sector_key: "finans", slug: "finans-rol-haritasi", title: "Finansta sık görülen yollar", order: 1, locale: "tr", cta_type: "chat", tags: ["unvan", "rota"],
      body: "Finans ve muhasebede operasyon, analitik ve kontrol / denetim hatları yaygındır. İlerleme sinyali çoğu zaman hatasız teslim, deadline disiplini ve iş birimi dilini anlama olarak görünür. Unvanlar kuruma göre değişir; “hangi raporu sahiplendin?” daha somuttur. Bu genel bir çerçevedir." },
    { sector_key: "finans", slug: "finans-ilk-90-gun", title: "İlk 90 günde neye odaklanmalısın?", order: 2, locale: "tr", cta_type: "micro_task", tags: ["ilk-90-gun"],
      body: "İlk ayda süreçleri ve kontrol noktalarını öğren; neden bu kontrol var diye sor. İkinci ayda tekrarlayan bir raporu hızlandır veya netleştir. Üçüncü ayda bir anomalinin nasıl yakalandığını yaz. Excel / ERP bilgisi araçtır; asıl değer, sayıyı iş kararına bağlamaktır. Kurum prosedürü her zaman önceliklidir." },
    { sector_key: "finans", slug: "finans-tuzak", title: "Sık görülen tuzak: Sadece formül bilmek", order: 3, locale: "tr", cta_type: "training", tags: ["tuzak"],
      body: "Formül bilmek işe giriş kapısı olabilir ama sürdürülebilir sinyal, doğruluk ve iletişimdir. Raporu “attım” demek yetmez; alıcının neye bakacağını bilmek gerekir. Belirsiz bir rakamı sormak zayıflık değil, kontrol kültürüdür. Eğitimleri gerçek bir tablo pratiğiyle eşleştir." },
    { sector_key: "finans", slug: "finans-sonraki-adim", title: "Bu hafta atabileceğin net adım", order: 4, locale: "tr", cta_type: "micro_task", tags: ["eylem"],
      body: "Bu hafta kullandığın bir raporu 5 satırda açıkla: amaç, kaynak, risk, alıcı, iyileştirme. Birine anlatmayı dene. Bu pratik analitik ve iletişim alanına dokunur. Sonra haftalık pratiklere veya ilgili eğitime geçebilirsin." },

    { sector_key: "saglik", slug: "saglik-rol-haritasi", title: "Sağlık sektöründe rehberlik notu", order: 1, locale: "tr", cta_type: "chat", tags: ["unvan", "rota"],
      body: "Sağlıkta klinik ve idari yollar ayrışır; lisans / yetki sınırları kritiktir. İlerleme çoğu zaman protokole uyum, ekip iletişimi ve hasta / danışan güvenliği etrafında anlatılır. Bu not genel bilgilendirmedir; tıbbi tavsiye veya yetki vaadi değildir. Kendi unvanının yasal çerçevesini her zaman doğrula." },
    { sector_key: "saglik", slug: "saglik-ilk-90-gun", title: "İlk 90 günde neye odaklanmalısın?", order: 2, locale: "tr", cta_type: "micro_task", tags: ["ilk-90-gun"],
      body: "İlk ayda protokoller, kayıt ve iletişim kanallarını öğren. İkinci ayda bir ekip rutininin parçası ol. Üçüncü ayda bir olayı öğrenme notuna dönüştür. Empati ile sınır koyma birlikte yürür. Bu öneriler geneldir; kurum politikası ve yasal çerçeve önceliklidir." },
    { sector_key: "saglik", slug: "saglik-tuzak", title: "Sık görülen tuzak: Tükenmişlik ve sessizlik", order: 3, locale: "tr", cta_type: "training", tags: ["tuzak"],
      body: "Yoğun tempoda “idare ederim” demek görünmez borç biriktirir. Erken geri bildirim istemek ve net öncelik sormak uzun vadede daha sağlıklıdır. Eğitim seçerken sürdürülebilir tempo ve iletişim becerilerini de hesaba kat. Bu bir klinik öneri değil; kariyer sürdürülebilirliği notudur." },
    { sector_key: "saglik", slug: "saglik-sonraki-adim", title: "Bu hafta atabileceğin net adım", order: 4, locale: "tr", cta_type: "micro_task", tags: ["eylem"],
      body: "Bu hafta bir zor iletişimi 5 cümleyle yaz: ne oldu, ne denedin, ne öğrendin. Mümkünse güvendiğin birine sor. Ardından CareerPick pratiklerinden birini seç. Tıbbi kararlar için her zaman yetkili profesyonellere danış." },

    { sector_key: "genel", slug: "genel-net-hedef", title: "Belirsiz hedefi netleştirmek", order: 1, locale: "tr", cta_type: "chat", tags: ["hedef"],
      body: "“İyi bir iş istiyorum” yerine “hangi sorunları çözmek istiyorum / hangi ortamda?” diye sor. Bir cümlelik hedef, eğitim ve ilan seçimini kolaylaştırır. Hedef değişebilir; önemli olan şu anki varsayımlarını yazmak. CareerPick sohbeti bunu yapılandırmana yardım eder. Bu genel bir çerçevedir; garanti sonuç vaat etmez." },
    { sector_key: "genel", slug: "genel-kanit", title: "Kanıt üret: öğren → uygula → anlat", order: 2, locale: "tr", cta_type: "micro_task", tags: ["pratik"],
      body: "Kurs bitirmek tek başına sinyal değildir. Küçük bir uygulama ve 3 cümlelik özet, profilini güçlendirir. Haftalık mikro pratikler bu alışkanlığı düşük eforla kurar. Eğitimlerini “neden bu?” gerekçesiyle seç. İlerleme yaklaşık bir gelişim sinyalidir; bilimsel ölçüm iddiası yoktur." },
    { sector_key: "genel", slug: "genel-ilan", title: "İlan okumayı öğren", order: 3, locale: "tr", cta_type: "training", tags: ["ilan"],
      body: "İlanlardaki zorunlu maddeleri ayır; hepsini aynı anda kapatmaya çalışma. Önce 2–3 boşluğu seç ve pratik / eğitim bağla. CareerPick ilan uyumu aracı buna yardımcı olabilir. Uyum skoru yaklaşık bir sinyaldir; işe alım garantisi değildir." },
  ];

  global.CP_SECTOR_NOTES_FALLBACK = NOTES;
})(typeof window !== "undefined" ? window : globalThis);

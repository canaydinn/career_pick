/**
 * Blog yazı gövdeleri — slug ile eşleşir (pages2-content blog.posts.slug)
 */
(function () {
  const TR = {
    "dijital-beceriler-2026": {
      lead: "İş ilanları ve yetenek raporları aynı tabloyu çiziyor: 2026’da teknik araç bilmek yetmiyor; problem çözme, veri okuryazarlığı ve insan–yapay zekâ iş birliği öne çıkıyor. Bu yazıda en çok talep gören on beceriyi ve her biri için pratik bir başlangıç yolunu özetliyoruz.",
      sections: [
        {
          h: "Neden şimdi?",
          p: [
            "Şirketler daha az rolle daha fazla çıktı bekliyor. Bu yüzden “tek işi yapan” profiller yerine, araçları birleştirip işi uçtan uca götüren adaylar tercih ediliyor.",
            "Career Pick sohbetinde hedef rolünü netleştirdiğinde, aşağıdaki becerilerden hangilerinin sende boşluk olduğunu daha hızlı görebilirsin.",
          ],
        },
        {
          h: "10 beceri (kısa liste)",
          bullets: [
            "Veri okuryazarlığı — tabloyu okuyup karar önermek",
            "Prompt / yapay zekâ asistan kullanımı — işi hızlandıran, kontrol eden kullanım",
            "Ürün düşüncesi — kullanıcı ihtiyacını sorun cümlesine çevirmek",
            "SQL veya no-code analitik — kendi sorunu kendin sorabilmek",
            "Otomasyon (Zapier, Make, script) — tekrarlayan işi azaltmak",
            "Görsel iletişim — dashboard, tek sayfalık özet, net slayt",
            "Yazılı netlik — kısa brief, iyi ticket, iyi e-posta",
            "Deney tasarlama — küçük test, ölçüm, öğrenme",
            "Siber hijyen temelleri — güvenli araç kullanımı",
            "Öğrenme çevikliği — yeni aracı 1–2 haftada işe yarar hale getirmek",
          ],
        },
        {
          h: "Nasıl öğrenmelisin?",
          p: [
            "Hepsini aynı anda alma. Hedef rol ilanlarından 2–3 beceriyi seç; her biri için “küçük bir kanıt” üret (örnek rapor, mini otomasyon, kısa case).",
            "Kanıt, CV ve LinkedIn’de tek cümlelik başarıya dönüşür. Bu, kurs sertifikasından daha ikna edicidir.",
          ],
        },
      ],
    },
    "ats-dostu-cv": {
      lead: "ATS (Applicant Tracking System) CV’ni anahtar kelime ve yapı üzerinden tarar. Amaç robotu kandırmak değil; hem makinenin hem insanın okuyabileceği temiz bir metin üretmektir.",
      sections: [
        {
          h: "ATS’nin sevdiği format",
          bullets: [
            "Tek sütun veya sade iki sütun; metin kutusu ve grafik şişkinliği yok",
            "Standart başlıklar: Deneyim, Eğitim, Beceriler, Projeler",
            "PDF (metin seçilebilir) veya DOCX — tarama görüntüsü PDF’ten kaçın",
            "İkon, tablo ve metin-as-image kullanma",
          ],
        },
        {
          h: "İçerik formülü",
          p: [
            "Her madde: eylem + bağlam + sonuç. “Sorumlu oldum” yerine “X sürecini Y ile Z% iyileştirdim” yaz.",
            "İlan metnindeki kritik becerileri doğal dilde tekrarla; anahtar kelime doldurmaca yapma. Aynı beceriyi hem Beceriler hem Deneyim satırında kanıtla.",
          ],
        },
        {
          h: "Hızlı kontrol listesi",
          bullets: [
            "İletişim bilgisi üstte, linkler çalışıyor",
            "Son 10 yıllık deneyim öncelikli; eski roller kısa",
            "Sayılar mümkün olduğunca (%, süre, hacim)",
            "Career Pick CV boşluk analizi ile hedef role göre eksikleri gör",
          ],
        },
      ],
    },
    "star-mulakat": {
      lead: "Davranışsal sorular geçmişteki davranışın gelecekteki performansı tahmin ettiğini varsayar. STAR, cevabını dağınık hikâyeden net bir kanıta çevirir.",
      sections: [
        {
          h: "STAR nedir?",
          bullets: [
            "Situation — bağlamı 1–2 cümlede kur",
            "Task — senin sorumluluğun / hedef",
            "Action — senin yaptığın adımlar (takım değil, sen)",
            "Result — ölçülebilir veya net sonuç + öğrenilen",
          ],
        },
        {
          h: "İyi bir STAR örneği yapısı",
          p: [
            "“Geçen çeyrekte müşteri şikayetleri arttı (S). Ben destek sürecini sadeleştirmekle görevlendirildim (T). Önce en sık 5 sorunu etiketledim, ardından yanıt şablonları ve bir triage kuralı kurdum (A). Ortalama çözüm süresi 2 günden 18 saate indi (R).”",
            "Action kısmını uzat; Situation’ı kısa tut. Sonuç yoksa en azından “ne öğrendin / bir sonraki denemede ne değişti” ekle.",
          ],
        },
        {
          h: "Hazırlık rutini",
          p: [
            "5–7 hikâye bankası çıkar: çatışma, öncelik, başarısızlık, liderlik, belirsizlik. Her birini STAR’a yazıp sesli 90 saniyede oku.",
            "Career Pick sohbetindeki yetkinlik senaryoları, hangi hikâyelerin zayıf kaldığını görmene yardım eder.",
          ],
        },
      ],
    },
    "transfer-edilebilir-beceriler": {
      lead: "Sektör değiştirmek ‘sıfırdan başlamak’ demek değil. İşveren, yeni alanda hemen değer üretecek kanıt arar. Transfer edilebilir beceriler bu köprüdür.",
      sections: [
        {
          h: "Ne transfer olur?",
          bullets: [
            "İletişim ve paydaş yönetimi",
            "Proje / öncelik yönetimi",
            "Analitik düşünme ve problem çözme",
            "Öğrenme hızı ve araç uyarlama",
            "Müşteri veya kullanıcı odaklılık",
          ],
        },
        {
          h: "Çeviri cümlesi yaz",
          p: [
            "Eski jargonu yeni sektör diline çevir. “Mağaza cirosu” → “gelir büyümesi”; “ders planı” → “öğrenme deneyimi tasarımı”.",
            "CV’de her maddenin altına ‘bu becerinin hedef roldeki karşılığı’ görünür olsun. İlan metnindeki fiilleri kullan.",
          ],
        },
        {
          h: "Kanıt üret",
          p: [
            "Küçük bir yan proje, gönüllü iş veya iç rotasyon; sektör dilinde tek sayfalık case yeter.",
            "Career Pick’te hedef sektörünü ve mevcut yeteneklerini netleştir; transfer haritanı sohbet çıktısıyla güncelle.",
          ],
        },
      ],
    },
    "maas-muzakeresi-hatalari": {
      lead: "Maaş konuşması çoğu adayda stres yaratır; stres de pahalı hatalara yol açar. İşte sık görülen beş tuzak ve yerine koyabileceğin davranış.",
      sections: [
        {
          h: "1) İlk rakamı sen söylemek",
          p: [
            "Mümkünse aralığı işverenden iste. Erken rakam verirsen tavanı kendi elinle düşürebilirsin. “Bu rol için bütçe aralığınız nedir?” sorusu meşrudur.",
          ],
        },
        {
          h: "2) Sadece net maaşa bakmak",
          p: [
            "Bonus, RSU, yan hak, uzaktan gün, öğrenim bütçesi toplam paketi değiştirir. Karşılaştırırken yıllık toplam değeri yaz.",
          ],
        },
        {
          h: "3) Piyasayı araştırmamak",
          p: [
            "Aynı unvan farklı şirkette farklı iş demektir. Seviye, ekip, şehir ve şirket tipine göre 2–3 kaynakla aralık çıkar.",
          ],
        },
        {
          h: "4) “Ne verirseniz” demek",
          p: [
            "Esneklik iyi niyet gibi görünür ama değerini belirsizleştirir. “X–Y aralığı hedefliyorum; paketin yapısına göre konuşalım” daha güçlüdür.",
          ],
        },
        {
          h: "5) Tek seferde bitirmek",
          p: [
            "Teklif geldiğinde teşekkür et, süre iste, yazılı olarak değerlendir. Karşı teklifte maaş + bir yan hak kombini sunmak sık işe yarar.",
          ],
        },
      ],
    },
    "haftada-5-saat-beceri": {
      lead: "Yoğun tempoda ‘bir gün boş kalınca öğrenirim’ planı genelde hiç başlamaz. Haftada 5 saat, doğru parçalanırsa görünür ilerleme üretir.",
      sections: [
        {
          h: "5 saati böl",
          bullets: [
            "2×60 dk — odak çalışması (kurs / kitap / proje)",
            "2×45 dk — uygulama (mini görev, kod, yazı, tasarım)",
            "1×30 dk — gözden geçirme ve gelecek hafta planı",
            "Kalan 30 dk — buffer (kayma payı)",
          ],
        },
        {
          h: "Tek çıktı kuralı",
          p: [
            "Her haftanın sonunda paylaşılabilir bir şey olsun: repo commit’i, 1 sayfalık not, kısa demo, güncellenmiş CV maddesi.",
            "Çıktı yoksa öğrenme hissi vardır, kanıt yoktur. İş başvurularında kanıt konuşur.",
          ],
        },
        {
          h: "Sürtünmeyi azalt",
          p: [
            "Aynı gün ve saate sabitle. Telefonsuz bir ortam seç. Haftalık hedefi tek cümle yaz: “Bu hafta X’i bitireceğim.”",
            "Career Pick pratikleri ve mikro görevler, 5 saatlik bloğu somut adımlara çevirmek için kullanılabilir.",
          ],
        },
      ],
    },
    "linkedin-profil": {
      lead: "LinkedIn, birçok işe alımcı için ilk Google sonucudur. Profilin CV’nin pazarlama yüzüdür: taranabilir, tarayıcıda hızlı okunur, anahtar kelime dostu.",
      sections: [
        {
          h: "Başlık (headline)",
          p: [
            "Unvan + uzmanlık + kanıt sinyali. “İş arıyorum” yerine “Ürün analisti | SQL & deney tasarımı | B2B SaaS”.",
          ],
        },
        {
          h: "Özet",
          p: [
            "İlk 2 satır mobilde kesilir; en güçlü cümleyi başa koy. Sonra: kimsin, kime değer üretiyorsun, 2–3 kanıt, net CTA (iletişim / portföy).",
          ],
        },
        {
          h: "Deneyim satırları",
          bullets: [
            "Fiil + etki; jargon azalt",
            "Her rolde 3–5 madde yeter",
            "Beceriler bölümünü ilanlarla hizala; abartma",
            "Öne çıkanlar: case, yazı, proje linki",
          ],
        },
      ],
    },
    "remote-portfoy": {
      lead: "Uzaktan roller, “yanımda çalışır mı?” sorusunu “asenkron güvenilir mi?” sorusuna çevirir. Portföyün bu soruya cevap vermeli.",
      sections: [
        {
          h: "Ne göstermeli?",
          bullets: [
            "Sonuç odaklı 2–4 case (problem → yaklaşım → sonuç)",
            "Araç yığınını ve iş birliği biçimini (async, dokümantasyon)",
            "İletişim örneği: net yazı, kısa video walkthrough",
            "Zaman dilimi / çalışma modeli netliği",
          ],
        },
        {
          h: "Başvuru metni",
          p: [
            "Cover letter yerine kısa not: neden bu rol, hangi case’in ilgili, nasıl çalışıyorsun. Linkleri tek satırda ver.",
            "CV’de remote / hibrit deneyimini gizleme; dağıtık ekip, yazılı iletişim, sahiplik örneklerini öne çıkar.",
          ],
        },
        {
          h: "Güven sinyalleri",
          p: [
            "Teslim tarihi tutma hikâyeleri, açık Git/Notion örnekleri, referanslar. “Esnek saat” vaadi yerine “overlap saatlerim” yazmak daha profesyoneldir.",
          ],
        },
      ],
    },
    "networking-4-yol": {
      lead: "Networking, kartvizit yağmurundan ibaret değil. Güçlü ağ; tekrarlayan, karşılıklı ve düşük baskılı ilişkilerden oluşur.",
      sections: [
        {
          h: "1) Değerle başla",
          p: [
            "“İş var mı?” yerine faydalı bir not, kaynak veya tanıştırma teklifi götür. İlk mesaj kısa ve kişisel olsun.",
          ],
        },
        {
          h: "2) Küçük çevre, düzenli ritim",
          p: [
            "10–15 kişiyle ayda bir anlamlı temas, 200 soğuk bağlantıdan daha değerlidir. Takvimde “ağ saati” tut.",
          ],
        },
        {
          h: "3) Topluluk içinde görünür ol",
          p: [
            "Meetup, Slack, açık kaynak veya sektör sohbetlerinde tutarlı katılım; tek seferlik “selam”dan güçlüdür.",
          ],
        },
        {
          h: "4) Takip et, kapat",
          p: [
            "Görüşme sonrası teşekkür + bir sonraki adım yaz. Yardım istediğin kişiyi güncelle (sonuç ne oldu?). Çember tamamlanır.",
          ],
        },
      ],
    },
  };

  const EN = {
    "dijital-beceriler-2026": {
      lead: "Job posts and talent reports point the same way: in 2026, tool knowledge alone is not enough. Problem-solving, data literacy and human–AI collaboration rise to the top. Here are ten high-demand skills and a practical way to start each.",
      sections: [
        {
          h: "Why now?",
          p: [
            "Companies expect more output from leaner teams. Profiles that combine tools and ship end-to-end work beat single-task specialists.",
            "When you clarify your target role in Career Pick chat, you can spot which of these skills are your gaps faster.",
          ],
        },
        {
          h: "The 10 skills (short list)",
          bullets: [
            "Data literacy — read a table and recommend a decision",
            "Prompt / AI-assistant use — accelerate work with control",
            "Product thinking — turn user need into a problem statement",
            "SQL or no-code analytics — ask your own questions",
            "Automation — reduce repetitive work",
            "Visual communication — dashboards and crisp one-pagers",
            "Written clarity — briefs, tickets, emails",
            "Experiment design — small test, measure, learn",
            "Basic cyber hygiene — safe tool use",
            "Learning agility — make a new tool useful in 1–2 weeks",
          ],
        },
        {
          h: "How to learn",
          p: [
            "Do not take all at once. Pick 2–3 skills from target-role postings and produce a small proof for each.",
            "Proof beats certificates on a CV: a sample report, a tiny automation, a short case.",
          ],
        },
      ],
    },
    "ats-dostu-cv": {
      lead: "An ATS scans structure and keywords. The goal is not to trick the robot — it is to produce clean text both machines and humans can read.",
      sections: [
        {
          h: "Formats ATS likes",
          bullets: [
            "Single column or simple two-column; avoid text boxes and heavy graphics",
            "Standard headings: Experience, Education, Skills, Projects",
            "Selectable-text PDF or DOCX — avoid scan-only PDFs",
            "Skip icons, tables and text-as-image",
          ],
        },
        {
          h: "Content formula",
          p: [
            "Each bullet: action + context + result. Replace “responsible for” with measurable impact.",
            "Mirror critical skills from the job post in natural language; prove them in Experience, not only in a Skills list.",
          ],
        },
        {
          h: "Quick checklist",
          bullets: [
            "Contact info on top, working links",
            "Prioritize the last ~10 years",
            "Numbers where possible",
            "Use Career Pick CV gap analysis against your target role",
          ],
        },
      ],
    },
    "star-mulakat": {
      lead: "Behavioral questions assume past behavior predicts future performance. STAR turns a messy story into clear evidence.",
      sections: [
        {
          h: "What is STAR?",
          bullets: [
            "Situation — set context in 1–2 sentences",
            "Task — your responsibility / goal",
            "Action — steps you took (you, not the team)",
            "Result — measurable outcome + what you learned",
          ],
        },
        {
          h: "Structure of a strong answer",
          p: [
            "Keep Situation short; expand Action. If results are soft, add what you learned and what you would change next.",
          ],
        },
        {
          h: "Prep routine",
          p: [
            "Build a bank of 5–7 stories: conflict, priorities, failure, leadership, ambiguity. Write each as STAR and rehearse in ~90 seconds.",
            "Competency scenarios in Career Pick chat show which stories still feel weak.",
          ],
        },
      ],
    },
    "transfer-edilebilir-beceriler": {
      lead: "Changing industries is not starting from zero. Employers want proof you can create value quickly. Transferable skills are that bridge.",
      sections: [
        {
          h: "What transfers?",
          bullets: [
            "Communication and stakeholder management",
            "Project / priority management",
            "Analytical thinking and problem-solving",
            "Learning speed and tool adaptation",
            "Customer or user focus",
          ],
        },
        {
          h: "Write the translation sentence",
          p: [
            "Rewrite old jargon in the new sector’s language. Make the mapping visible on your CV.",
          ],
        },
        {
          h: "Produce proof",
          p: [
            "A small side project, volunteer work or internal rotation — one page in sector language is enough.",
          ],
        },
      ],
    },
    "maas-muzakeresi-hatalari": {
      lead: "Salary talks are stressful — and stress creates expensive mistakes. Five common traps and what to do instead.",
      sections: [
        {
          h: "1) Naming a number too early",
          p: ["Ask for the budget range when you can. Early anchors can lower your ceiling."],
        },
        {
          h: "2) Looking only at base pay",
          p: ["Bonus, equity, benefits and flexibility change total value. Compare annual packages."],
        },
        {
          h: "3) Skipping market research",
          p: ["Same title ≠ same job. Build a range by level, team, city and company type."],
        },
        {
          h: "4) “Whatever you offer”",
          p: ["It sounds flexible but erases your value. State a range and discuss package structure."],
        },
        {
          h: "5) Closing in one breath",
          p: ["Thank them, ask for time, evaluate in writing. Counter with salary plus one benefit lever."],
        },
      ],
    },
    "haftada-5-saat-beceri": {
      lead: "“I’ll learn when I have a free day” usually means never. Five focused hours a week, split well, create visible progress.",
      sections: [
        {
          h: "Split the 5 hours",
          bullets: [
            "2×60 min focused study",
            "2×45 min practice",
            "1×30 min review and next-week plan",
            "30 min buffer",
          ],
        },
        {
          h: "One-output rule",
          p: [
            "End each week with something shareable: a commit, a one-pager, a short demo, an updated CV bullet.",
          ],
        },
        {
          h: "Reduce friction",
          p: [
            "Same day and time. Phone-free space. One-sentence weekly goal.",
          ],
        },
      ],
    },
    "linkedin-profil": {
      lead: "For many recruiters, LinkedIn is the first search result. Your profile is the marketing face of your CV.",
      sections: [
        {
          h: "Headline",
          p: ["Title + expertise + proof signal — not just “open to work”."],
        },
        {
          h: "About",
          p: ["Lead with the strongest line (mobile truncates). Then who you help, 2–3 proofs, a clear CTA."],
        },
        {
          h: "Experience",
          bullets: [
            "Verb + impact",
            "3–5 bullets per role",
            "Align Skills with real job posts",
            "Feature cases and links",
          ],
        },
      ],
    },
    "remote-portfoy": {
      lead: "Remote roles swap “will they work beside me?” for “are they reliable async?” Your portfolio should answer that.",
      sections: [
        {
          h: "What to show",
          bullets: [
            "2–4 outcome cases",
            "Tools and collaboration style",
            "Clear writing or a short walkthrough",
            "Timezone / working-model clarity",
          ],
        },
        {
          h: "Application note",
          p: ["Why this role, which case fits, how you work — links in one line."],
        },
        {
          h: "Trust signals",
          p: ["Delivery stories, open docs/repos, references. Prefer overlap hours over vague “flexible schedule”."],
        },
      ],
    },
    "networking-4-yol": {
      lead: "Networking is not a shower of business cards. Strong networks are reciprocal, low-pressure and repeated.",
      sections: [
        {
          h: "1) Lead with value",
          p: ["Offer a note, resource or intro before asking for a job."],
        },
        {
          h: "2) Small circle, steady rhythm",
          p: ["Meaningful monthly contact with 10–15 people beats 200 cold connects."],
        },
        {
          h: "3) Be visible in communities",
          p: ["Consistent presence in meetups, Slacks or OSS beats one-off hellos."],
        },
        {
          h: "4) Follow up and close the loop",
          p: ["Thanks + next step. Update people who helped you. Circles complete."],
        },
      ],
    },
  };

  const UI = {
    tr: {
      back: "Blog’a dön",
      ctaTitle: "Bu konuyu sana özel netleştirelim",
      ctaBody: "Career Pick sohbetinde hedef rolünü ve boşluklarını konuş; sonraki adımın somutlaşsın.",
      ctaBtn: "Sohbete başla",
      notFound: "Yazı bulunamadı.",
    },
    en: {
      back: "Back to blog",
      ctaTitle: "Let’s make this concrete for you",
      ctaBody: "In Career Pick chat, clarify your target role and gaps so your next step is actionable.",
      ctaBtn: "Start chat",
      notFound: "Article not found.",
    },
  };

  window.CP_BLOG_ARTICLES = { tr: TR, en: EN, ui: UI };
})();

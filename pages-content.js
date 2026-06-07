// Career Pick — content for sub-pages (Features, How, Pricing, Changelog)
(function () {
  const TR = {
    features: {
      hero: {
        eyebrow: "Özellikler",
        title: ["Kariyerini ileri taşıyan", "akıllı araçlar"],
        sub: "Career Pick, kariyerinin her aşamasında yanında. CV'nden öğrenme planına kadar her şeyi tek bir yapay zekâ asistanında birleştirir.",
        cta: "Asistanı ücretsiz dene",
      },
      deep: [
        {
          icon: "doc", tag: "CV",
          title: "CV Analizi & İyileştirme",
          body: "Yapay zekâ CV'ni satır satır okur; etki yaratan ifadeleri güçlendirir, eksik anahtar kelimeleri bulur ve işe alım sistemlerine (ATS) uyumlu hâle getirir.",
          points: ["Etki cümlelerini yeniden yazma önerileri", "ATS uyum skoru ve eksik anahtar kelimeler", "Sektöre özel ölçülebilir başarı örnekleri", "Anlık, uygulanabilir geri bildirim"],
        },
        {
          icon: "route", tag: "Rota",
          title: "Kişisel Kariyer Rotası",
          body: "Bulunduğun noktadan hedef rolüne giden adım adım bir yol haritası. Gerçek pozisyon ilanları ve piyasa verisiyle desteklenir.",
          points: ["Hedef role özel yetkinlik haritası", "Ara roller ve gerçekçi zaman çizelgesi", "Piyasa talebi ve maaş aralığı içgörüleri", "Her adım için somut bir sonraki hamle"],
        },
        {
          icon: "spark", tag: "Beceri",
          title: "Beceri Boşluğu & Öğrenme Planı",
          body: "Hedefin için eksik becerileri tespit eder ve bunları haftalık, çalışılabilir bir öğrenme planına dönüştürür.",
          points: ["Sahip olduğun vs. gereken beceri karşılaştırması", "Önceliklendirilmiş öğrenme yol haritası", "Haftalık çalışma planı ve kaynak önerileri", "İlerleme takibi ile hedefe odaklanma"],
        },
      ],
      more: {
        eyebrow: "Dahası",
        title: "Tek asistan, tüm kariyer ihtiyaçların",
        items: [
          { icon: "doc", title: "Mülakat hazırlığı", body: "Role özel pratik sorular ve cevap çatıları ile kendine güvenle gir." },
          { icon: "route", title: "LinkedIn optimizasyonu", body: "Profilini görünür ve etkileyici hâle getir; başlık ve özet önerileri." },
          { icon: "spark", title: "Maaş içgörüleri", body: "Pozisyon ve deneyimine göre güncel maaş aralıklarını öğren." },
          { icon: "bolt", title: "Hedef belirleme", body: "Belirsiz isteklerini net, ölçülebilir kariyer hedeflerine dönüştür." },
          { icon: "globe", title: "Sektör keşfi", body: "Sana uyabilecek alternatif sektör ve rolleri keşfet." },
          { icon: "check", title: "İlerleme takibi", body: "Attığın adımları işaretle, momentumunu canlı tut." },
        ],
      },
      cta: { title: "Bütün bunları bir sohbetle dene.", sub: "Kredi kartı gerekmez. Asistana ilk sorunu sor.", btn: "Asistanla konuş" },
    },
    how: {
      hero: {
        eyebrow: "Nasıl çalışır",
        title: ["Üç adımda", "kariyer netliği"],
        sub: "Career Pick'i kullanmak bir sohbet kadar kolay. Birkaç dakikada ilk kişisel rotanı çıkar.",
        cta: "Hemen başla",
      },
      steps: [
        { n: "01", title: "Paylaş", body: "CV'ni yükle ya da hedefini tek cümleyle yaz. Asistan birkaç soruyla seni tanır.", detail: ["CV yükleme veya serbest metin", "Mevcut rol ve hedef", "Tercih ettiğin sektör ve çalışma biçimi"] },
        { n: "02", title: "Analiz et", body: "Yapay zekâ profilini, güçlü yönlerini ve piyasayı analiz ederek boşlukları bulur.", detail: ["Beceri ve deneyim haritası", "Piyasa talebi ile eşleştirme", "Güçlü yönler ve gelişim alanları"] },
        { n: "03", title: "İlerle", body: "Sana özel kariyer rotası ve haftalık öğrenme planıyla harekete geç.", detail: ["Adım adım kariyer rotası", "Haftalık öğrenme planı", "Takip edilebilir ilerleme"] },
      ],
      output: {
        eyebrow: "Sonuç",
        title: "Elinde ne olur?",
        sub: "Career Pick boş tavsiyeler vermez — somut, uygulanabilir bir plan üretir.",
        items: [
          { k: "Kariyer rotası", v: "Hedef role giden net yol haritası" },
          { k: "Öğrenme planı", v: "Önceliklendirilmiş haftalık program" },
          { k: "Güçlü CV", v: "İyileştirilmiş, ATS uyumlu özgeçmiş" },
          { k: "Sonraki adım", v: "Bugün yapabileceğin somut bir hamle" },
        ],
      },
      cta: { title: "İlk rotanı çıkarmaya hazır mısın?", sub: "Dakikalar içinde net bir plana sahip ol.", btn: "Asistanla başla" },
    },
    pricing: {
      hero: {
        eyebrow: "Fiyatlandırma",
        title: ["Kariyerine yatırım", "yapmanın en kolay yolu"],
        sub: "Ücretsiz başla, ihtiyacın büyüdükçe yükselt. İstediğin zaman iptal et.",
      },
      toggle: { monthly: "Aylık", yearly: "Yıllık", save: "2 ay bedava" },
      plans: [
        { name: "Başlangıç", priceM: "₺0", priceY: "₺0", period: "sonsuza dek", tagline: "Keşfetmeye başlamak için.", features: ["Asistanla sınırsız sohbet", "Temel CV analizi", "1 kariyer rotası", "Topluluk kaynakları"], cta: "Ücretsiz başla", featured: false },
        { name: "Pro", priceM: "₺199", priceY: "₺166", period: "/ ay", tagline: "Ciddi bir kariyer hamlesi için.", features: ["Başlangıç'taki her şey", "Detaylı CV & ATS raporu", "Sınırsız kariyer rotası", "Haftalık öğrenme planları", "Mülakat hazırlığı", "Maaş içgörüleri"], cta: "Pro'yu dene", featured: true },
        { name: "Takım", priceM: "₺149", priceY: "₺124", period: "/ kişi / ay", tagline: "Kariyer merkezleri ve ekipler için.", features: ["Pro'daki her şey", "Ekip paneli ve raporlar", "Toplu davet ve yönetim", "Öncelikli destek", "Özel entegrasyonlar"], cta: "İletişime geç", featured: false },
      ],
      faqTitle: "Fiyatlandırma soruları",
      faq: [
        { q: "Ücretsiz plan gerçekten ücretsiz mi?", a: "Evet. Asistanla sohbet ve temel CV analizi süresiz ücretsizdir; kredi kartı istemez." },
        { q: "İstediğim zaman iptal edebilir miyim?", a: "Elbette. Aboneliğini tek tıkla, ceza olmadan istediğin an iptal edebilirsin." },
        { q: "Öğrenci indirimi var mı?", a: "Evet, geçerli öğrenci e-postasıyla Pro planda %50 indirim sunuyoruz." },
        { q: "Ödeme yöntemleri neler?", a: "Tüm büyük kredi/banka kartları ve kurumsal müşteriler için fatura desteklenir." },
      ],
    },
    changelog: {
      hero: {
        eyebrow: "Güncellemeler",
        title: ["Career Pick'te", "yeni neler var?"],
        sub: "Ürünü sürekli geliştiriyoruz. En yeni özellikler, iyileştirmeler ve düzeltmeler burada.",
      },
      entries: [
        { version: "v2.4", date: "Mayıs 2026", tags: [{ t: "new", l: "Yeni" }], title: "Mülakat hazırlık modu", items: ["Role özel pratik soruları üreten yeni asistan modu", "Cevap çatıları ve geri bildirim", "8 yeni sektör desteği"] },
        { version: "v2.3", date: "Nisan 2026", tags: [{ t: "improved", l: "İyileştirme" }], title: "Daha akıllı kariyer rotaları", items: ["Piyasa verisiyle güncellenen rota algoritması", "Ara roller için zaman çizelgesi görünümü", "Maaş aralığı içgörüleri eklendi"] },
        { version: "v2.2", date: "Mart 2026", tags: [{ t: "new", l: "Yeni" }, { t: "fixed", l: "Düzeltme" }], title: "Haftalık öğrenme planları", items: ["Beceri boşluğunu haftalık programa dönüştürme", "Kaynak önerileri ve ilerleme takibi", "CV yükleme hatası giderildi"] },
        { version: "v2.1", date: "Şubat 2026", tags: [{ t: "improved", l: "İyileştirme" }], title: "Yenilenen CV analizi", items: ["ATS uyum skoru eklendi", "Etki cümlesi önerileri %40 daha isabetli", "Daha hızlı analiz"] },
        { version: "v2.0", date: "Ocak 2026", tags: [{ t: "new", l: "Yeni" }], title: "Career Pick 2.0", items: ["Tamamen yeni asistan deneyimi", "Türkçe ve İngilizce tam destek", "Yeniden tasarlanan arayüz"] },
      ],
      tagLabels: { new: "Yeni", improved: "İyileştirme", fixed: "Düzeltme" },
    },
  };

  const EN = {
    features: {
      hero: {
        eyebrow: "Features",
        title: ["Smart tools that move", "your career forward"],
        sub: "Career Pick is with you at every stage of your career. From your resume to your learning plan, everything lives in one AI assistant.",
        cta: "Try the assistant free",
      },
      deep: [
        { icon: "doc", tag: "Resume", title: "Resume Analysis & Boost", body: "The AI reads your resume line by line — strengthening impact statements, finding missing keywords and making it ATS-friendly.", points: ["Rewrite suggestions for impact lines", "ATS score and missing keywords", "Industry-specific measurable wins", "Instant, actionable feedback"] },
        { icon: "route", tag: "Path", title: "Personal Career Path", body: "A step-by-step roadmap from where you are to your target role — grounded in real job posts and market data.", points: ["Skill map tailored to your target role", "Intermediate roles and realistic timeline", "Market demand and salary insights", "A concrete next step for each stage"] },
        { icon: "spark", tag: "Skills", title: "Skill Gap & Learning Plan", body: "Detects the skills you're missing for your goal and turns them into a weekly, doable learning plan.", points: ["Have vs. need skill comparison", "Prioritized learning roadmap", "Weekly study plan and resources", "Progress tracking to stay focused"] },
      ],
      more: {
        eyebrow: "And more",
        title: "One assistant, all your career needs",
        items: [
          { icon: "doc", title: "Interview prep", body: "Walk in confident with role-specific practice questions and answer frameworks." },
          { icon: "route", title: "LinkedIn optimization", body: "Make your profile visible and compelling with headline and summary suggestions." },
          { icon: "spark", title: "Salary insights", body: "See up-to-date salary ranges for your role and experience." },
          { icon: "bolt", title: "Goal setting", body: "Turn vague wishes into clear, measurable career goals." },
          { icon: "globe", title: "Industry discovery", body: "Explore alternative industries and roles that might fit you." },
          { icon: "check", title: "Progress tracking", body: "Check off the steps you take and keep your momentum alive." },
        ],
      },
      cta: { title: "Try all of this in one conversation.", sub: "No credit card needed. Ask the assistant your first question.", btn: "Talk to the assistant" },
    },
    how: {
      hero: { eyebrow: "How it works", title: ["Career clarity", "in three steps"], sub: "Using Career Pick is as easy as a conversation. Build your first personal path in minutes.", cta: "Get started" },
      steps: [
        { n: "01", title: "Share", body: "Upload your resume or describe your goal in one sentence. The assistant gets to know you.", detail: ["Resume upload or free text", "Current role and goal", "Preferred industry and work style"] },
        { n: "02", title: "Analyze", body: "The AI analyzes your profile, strengths and the market to find the gaps.", detail: ["Skill and experience map", "Match against market demand", "Strengths and growth areas"] },
        { n: "03", title: "Progress", body: "Move forward with a personal career path and a weekly learning plan.", detail: ["Step-by-step career path", "Weekly learning plan", "Trackable progress"] },
      ],
      output: { eyebrow: "Outcome", title: "What do you walk away with?", sub: "Career Pick doesn't give empty advice — it produces a concrete, actionable plan.", items: [
        { k: "Career path", v: "A clear roadmap to your target role" },
        { k: "Learning plan", v: "A prioritized weekly program" },
        { k: "Stronger resume", v: "An improved, ATS-friendly CV" },
        { k: "Next step", v: "One concrete move you can make today" },
      ] },
      cta: { title: "Ready to build your first path?", sub: "Have a clear plan in minutes.", btn: "Start with the assistant" },
    },
    pricing: {
      hero: { eyebrow: "Pricing", title: ["The easiest way to", "invest in your career"], sub: "Start free, upgrade as your needs grow. Cancel anytime." },
      toggle: { monthly: "Monthly", yearly: "Yearly", save: "2 months free" },
      plans: [
        { name: "Starter", priceM: "$0", priceY: "$0", period: "forever", tagline: "To start exploring.", features: ["Unlimited assistant chat", "Basic resume analysis", "1 career path", "Community resources"], cta: "Start free", featured: false },
        { name: "Pro", priceM: "$9", priceY: "$7.5", period: "/ mo", tagline: "For a serious career move.", features: ["Everything in Starter", "Detailed resume & ATS report", "Unlimited career paths", "Weekly learning plans", "Interview prep", "Salary insights"], cta: "Try Pro", featured: true },
        { name: "Team", priceM: "$7", priceY: "$5.8", period: "/ seat / mo", tagline: "For career centers and teams.", features: ["Everything in Pro", "Team dashboard and reports", "Bulk invites and management", "Priority support", "Custom integrations"], cta: "Contact us", featured: false },
      ],
      faqTitle: "Pricing questions",
      faq: [
        { q: "Is the free plan really free?", a: "Yes. Chatting with the assistant and basic resume analysis are free forever — no credit card." },
        { q: "Can I cancel anytime?", a: "Of course. Cancel your subscription in one click, anytime, with no penalty." },
        { q: "Is there a student discount?", a: "Yes, we offer 50% off Pro with a valid student email." },
        { q: "What payment methods do you accept?", a: "All major credit/debit cards, plus invoicing for enterprise customers." },
      ],
    },
    changelog: {
      hero: { eyebrow: "Changelog", title: ["What's new in", "Career Pick?"], sub: "We're always improving. Find the latest features, improvements and fixes here." },
      entries: [
        { version: "v2.4", date: "May 2026", tags: [{ t: "new", l: "New" }], title: "Interview prep mode", items: ["New assistant mode that generates role-specific practice questions", "Answer frameworks and feedback", "8 new industries supported"] },
        { version: "v2.3", date: "Apr 2026", tags: [{ t: "improved", l: "Improved" }], title: "Smarter career paths", items: ["Path algorithm updated with market data", "Timeline view for intermediate roles", "Salary range insights added"] },
        { version: "v2.2", date: "Mar 2026", tags: [{ t: "new", l: "New" }, { t: "fixed", l: "Fixed" }], title: "Weekly learning plans", items: ["Turn skill gaps into a weekly program", "Resource suggestions and progress tracking", "Fixed a resume upload bug"] },
        { version: "v2.1", date: "Feb 2026", tags: [{ t: "improved", l: "Improved" }], title: "Revamped resume analysis", items: ["Added ATS compatibility score", "Impact-line suggestions 40% more accurate", "Faster analysis"] },
        { version: "v2.0", date: "Jan 2026", tags: [{ t: "new", l: "New" }], title: "Career Pick 2.0", items: ["A brand-new assistant experience", "Full Turkish and English support", "Redesigned interface"] },
      ],
      tagLabels: { new: "New", improved: "Improved", fixed: "Fixed" },
    },
  };

  if (window.CP_CONTENT) {
    window.CP_CONTENT.tr.pages = TR;
    window.CP_CONTENT.en.pages = EN;
  }
})();

// ============================================================================
// KONFIGURASI KONTEN, POSE MASKOT PEMANDU & PARAMETER KALKULATOR AWAM
// Catatan Keamanan (Guardrail #5 & #8):
// - Angka di PUBLIC_CALCULATOR_CONFIG hanyalah kisaran indikatif publik umum
//   (BUKAN tabel rate, margin, komisi, atau premi asuransi bank mitra).
// - Seluruh kontak/alamat resmi menggunakan penanda [KONFIRMASI PEMILIK: ...].
// ============================================================================

export const PUBLIC_CALCULATOR_CONFIG = {
  minPlafond: 10_000_000,
  maxPlafond: 300_000_000,
  plafondStep: 5_000_000,
  minAge: 45,
  maxAge: 75,
  maxMaturityAge: 80,
  seniorAdvisoryAge: 70,
  maxTenorYears: 15,
  prapenNearTermMonths: 36,
  prapenMaxMonthsToRetirement: 120,
  indicativeAnnualRateLow: 0.115,
  indicativeAnnualRateHigh: 0.145,
  safeInstallmentRatio: 0.7
};

export const LOAN_GOALS = [
  {
    id: "usaha",
    label: "Modal Usaha Pensiun",
    shortLabel: "Modal Usaha",
    recommendedPlafond: 100_000_000,
    recommendedTenorYears: 8,
    mascotTip:
      "Banyak Bapak/Ibu pensiunan membuka usaha warung, kos-kosan, atau kebun dengan cicilan ringan sambil tetap memegang sisa uang pensiun bulanan yang aman."
  },
  {
    id: "renovasi",
    label: "Renovasi Rumah Keluarga",
    shortLabel: "Renovasi Rumah",
    recommendedPlafond: 75_000_000,
    recommendedTenorYears: 6,
    mascotTip:
      "Perbaiki atau perluas rumah agar makin nyaman ditempati bersama anak dan cucu, tanpa menguras tabungan harian Bapak/Ibu."
  },
  {
    id: "keluarga",
    label: "Pendidikan & Hajatan Anak",
    shortLabel: "Biaya Keluarga",
    recommendedPlafond: 50_000_000,
    recommendedTenorYears: 5,
    mascotTip:
      "Wujudkan rencana pendidikan atau pernikahan putra-putri dengan tenang. Cicilan diatur ringan menyesuaikan uang pensiun bulanan."
  },
  {
    id: "takeover",
    label: "Ringankan Cicilan Lama (Take Over)",
    shortLabel: "Take Over Cicilan",
    recommendedPlafond: 150_000_000,
    recommendedTenorYears: 10,
    mascotTip:
      "Masih punya potongan pinjaman lama di tempat lain? Konsultan cabang kami siap menghitungkan pelunasan (take over) agar sisa gaji bulanan Bapak/Ibu kembali lega."
  }
];

export const MASCOT_INTENT_MENUS = [
  {
    id: "pinjam-baru",
    badge: "Simulasi Pensiun Murni",
    title: "Saya ingin tahu berapa dana yang bisa saya pinjam",
    description:
      "Untuk penerima manfaat pensiun bulanan TASPEN, ASABRI, atau Dapen BUMN yang ingin melihat perkiraan cicilan & sisa gaji.",
    actionLabel: "Mulai Hitung Dana",
    introLabel: "Saya ingin tahu berapa dana yang bisa dipinjam",
    pensionStatus: "Sudah Pensiun",
    institution: "TASPEN",
    age: 63,
    goalId: "usaha",
    plafond: 100_000_000,
    tenorYears: 8,
    tint: "#F2EEFA",
    accent: "#351080"
  },
  {
    id: "take-over",
    badge: "Penataan Cicilan (Take Over)",
    title: "Saya ingin meringankan potongan cicilan pinjaman lama",
    description:
      "Bantu hitung ulang pelunasan kredit berjalan agar potongan bulanan lebih ringan dan sisa uang pensiun kembali lega.",
    actionLabel: "Hitung Take Over",
    introLabel: "Saya ingin meringankan cicilan pinjaman lama",
    pensionStatus: "Sudah Pensiun",
    institution: "TASPEN",
    age: 62,
    goalId: "takeover",
    plafond: 150_000_000,
    tenorYears: 10,
    tint: "#FEF4E6",
    accent: "#D97706"
  },
  {
    id: "prapensiun",
    badge: "Program Prapensiun (50–59 Thn)",
    title: "Saya masih dinas aktif & ingin persiapan sebelum pensiun",
    description:
      "Bagi ASN, PNS, TNI/Polri, dan pegawai BUMN aktif menjelang purnabakti yang merencanakan modal usaha atau biaya keluarga.",
    actionLabel: "Simulasi Prapensiun",
    introLabel: "Saya masih aktif & ingin siapkan prapensiun",
    pensionStatus: "Prapensiun",
    institution: "PNS AKTIF",
    age: 55,
    goalId: "usaha",
    plafond: 120_000_000,
    tenorYears: 10,
    tint: "#E8F7F2",
    accent: "#078D67"
  },
  {
    id: "cek-cabang",
    badge: "7 Kanwil & 29 Kota Layanan",
    title: "Saya ingin cek kantor cabang di kota saya & konsultasi",
    description:
      "Lihat daftar 29 kota layanan cabang kami atau langsung jadwalkan obrolan santai gratis dengan konsultan terdekat.",
    actionLabel: "Cek Cabang Terdekat",
    introLabel: "Saya ingin cek kantor cabang terdekat",
    pensionStatus: "Sudah Pensiun",
    institution: "TASPEN",
    age: 63,
    goalId: "keluarga",
    plafond: 75_000_000,
    tenorYears: 6,
    tint: "#EDF2FB",
    accent: "#17223B"
  }
];

export const GAME_INTRO_CONFIG = {
  titleHeadline: "Selamat Datang di Layanan Pensiunan",
  titleSub: "Pendamping rencana pembiayaan pensiun dan prapensiun Bapak/Ibu.",
  startCta: "Ketuk untuk Mulai",
  tapHint: "Dengar sapaan panduan",
  speakerName: "Layanan Pensiunan",
  poseGreeting: "/brand/mascot-intro-salam.webp",
  posePointing: "/brand/mascot-intro-point.webp",
  voiceSrc: "/brand/voice-welcome.mp3",
  voiceClips: {
    welcome: "/brand/voice-welcome.mp3",
    profile: "/brand/voice-profile.mp3",
    loan: "/brand/voice-guide.mp3",
    branch: "/brand/voice-branch.mp3",
    salam: "/brand/voice-salam.mp3"
  },
  fallbackCharsPerSecond: 16,
  // Sinkron dengan rekaman natural voice-welcome.mp3 (~6 detik)
  dialogPages: [
    "Halo Bapak dan Ibu, selamat datang di Layanan Pensiunan.",
    "Silakan pilih keperluan di bawah ini, saya bantu pelan-pelan ya."
  ],
  choicePrompt: "Keperluan apa yang bisa saya bantu hari ini?"
};

export const SITE_CONTENT = {
  brand: {
    name: "Layanan Pensiunan",
    tagline: "Solusi Kredit Pensiun",
    logoHorizontal: "/brand/layanan-pensiunan-logo-horizontal.png",
    logoVertical: "/brand/layanan-pensiunan-logo-vertical.png",
    logoSilhouette: "/brand/logo-mark-silhouette.png"
  },

  companyProfile: {
    parentCompany: "PT Kolaborasi Ekosistem Nusantara (KEN)",
    parentTagline: "Connecting Ecosystem, Empowering People",
    parentTaglineMeaning:
      "Ekosistem yang kuat menghubungkan potensi. Manusia yang berdaya mengubah keterhubungan menjadi kemajuan.",
    legalEntity: "PT Kolaborasi Ekosistem Nusantara (KEN)",
    kenStoryHeadline: "Pertumbuhan yang baik tidak dibangun sendirian.",
    kenStoryParagraphs: [
      "Di balik setiap rencana pembiayaan pensiun, ada keluarga yang ingin menata masa depan dengan tenang, tenaga pemasaran yang perlu dibina dengan etika kerja jelas, serta bank mitra yang membutuhkan saluran distribusi tertib.",
      "PT Kolaborasi Ekosistem Nusantara (KEN) hadir menjembatani ketiganya agar informasi disampaikan jujur, berkas tertata rapi, dan calon nasabah dilayani dengan sopan tanpa tekanan."
    ],
    philosophySteps: [
      {
        code: "CONNECT",
        label: "Mempertemukan",
        detail: "Menghubungkan kebutuhan calon nasabah, tenaga pemasaran, dan bank mitra tepat sasaran."
      },
      {
        code: "ENABLE",
        label: "Memungkinkan",
        detail: "Menyediakan standar layanan, alat simulasi awal, pelatihan, dan dukungan administrasi."
      },
      {
        code: "EMPOWER",
        label: "Memberdayakan",
        detail: "Membantu nasabah mengambil keputusan utuh sambil membina kemandirian jaringan lapangan."
      },
      {
        code: "GROW",
        label: "Menumbuhkan",
        detail: "Membangun layanan jangka panjang yang dipercaya nasabah, bank mitra, dan masyarakat."
      }
    ],
    primaValues: [
      {
        letter: "P",
        name: "Partnership",
        subtitle: "Kemitraan Strategis",
        description:
          "Menghargai keahlian, mendengar kebutuhan dengan sabar, berkomunikasi terbuka, dan menepati komitmen."
      },
      {
        letter: "R",
        name: "Responsibility",
        subtitle: "Integritas & Tanggung Jawab",
        description:
          "Menjaga akurasi informasi, kerahasiaan data pribadi, kepatuhan prosedur, serta perlindungan konsumen."
      },
      {
        letter: "I",
        name: "Innovation",
        subtitle: "Inovasi & Teknologi Aman",
        description:
          "Memanfaatkan sistem digital untuk menyederhanakan simulasi dan koordinasi layanan dengan tetap menjaga keamanan data."
      },
      {
        letter: "M",
        name: "Meaningful Empowerment",
        subtitle: "Pemberdayaan Bermakna",
        description:
          "Berbagi pengetahuan, membina tim lapangan, dan membantu keluarga memahami setiap pilihan sebelum memutuskan."
      },
      {
        letter: "A",
        name: "Adaptive Growth",
        subtitle: "Pertumbuhan Adaptif",
        description:
          "Menetapkan sasaran realistis, mengelola risiko, dan tumbuh sehat tanpa mengorbankan etika layanan."
      }
    ],
    authorityBoundaryTitle: "Batas Kewenangan yang Jelas",
    authorityBoundary:
      "Bank atau lembaga jasa keuangan mitra bertanggung jawab penuh atas ketentuan produk, penilaian kelayakan, persetujuan kredit, perjanjian pembiayaan, dan pencairan dana. PT Kolaborasi Ekosistem Nusantara (KEN) melalui Layanan Pensiunan menjalankan fungsi pemasaran, pemberian informasi, pendampingan administrasi, dan koordinasi proses sesuai perjanjian kerja sama yang berlaku.",
    servedSegments: [
      {
        code: "TASPEN",
        label: "Pensiunan PNS / ASN",
        detail: "Penerima manfaat pensiun bulanan melalui PT TASPEN (Persero)."
      },
      {
        code: "ASABRI",
        label: "Pensiunan TNI / Polri",
        detail: "Penerima manfaat purnawirawan dan pensiun melalui PT ASABRI (Persero)."
      },
      {
        code: "BUMN",
        label: "Pensiunan BUMN & Dapen",
        detail: "Peserta Dana Pensiun BUMN dan lembaga negara mitra."
      },
      {
        code: "PRAPENSIUN",
        label: "Pegawai Aktif (50–59 Tahun)",
        detail: "ASN, TNI/Polri, dan pegawai BUMN aktif menjelang purnabakti."
      }
    ],
    antiFraudStandards: [
      {
        no: "01",
        title: "Pencairan Langsung Bank Mitra, Bukan Pinjol",
        description:
          "Layanan Pensiunan bukan pinjaman online ilegal. Dana pembiayaan dicairkan langsung oleh Bank Mitra ke rekening tabungan atas nama Bapak/Ibu sendiri."
      },
      {
        no: "02",
        title: "Rp 0 Biaya di Muka",
        description:
          "Konsultasi, pengecekan kelayakan awal, dan lembar hitung uang terima bersih diberikan gratis. Tolak permintaan transfer uang muka ke rekening pribadi mana pun."
      },
      {
        no: "03",
        title: "Tanpa Unggah KTP atau SK di Website",
        description:
          "Halaman ini tidak pernah meminta foto KTP, SK Pensiun, kode OTP, atau PIN ATM. Pemeriksaan berkas hanya dilakukan tatap muka bersama petugas cabang."
      }
    ],
    serviceJourney: [
      {
        no: "01",
        title: "Mendengar & Memahami",
        description:
          "Menyimak kebutuhan, rencana keluarga, dan pertanyaan Bapak/Ibu dengan komunikasi sopan dan santai."
      },
      {
        no: "02",
        title: "Penjelasan Produk yang Jelas",
        description:
          "Menyampaikan persyaratan, komponen biaya, risiko, dan batas layanan mengacu pada ketentuan bank mitra."
      },
      {
        no: "03",
        title: "Simulasi Awal Cicilan",
        description:
          "Memberi gambaran perkiraan angsuran dan sisa gaji bulanan. Hasil hitung awal ini bukan persetujuan kredit."
      },
      {
        no: "04",
        title: "Penyiapan Kelengkapan Berkas",
        description:
          "Membantu Bapak/Ibu mencocokkan daftar dokumen asli serta urutan administrasi dengan sabar."
      },
      {
        no: "05",
        title: "Koordinasi ke Bank Mitra",
        description:
          "Meneruskan berkas pengajuan ke bank atau lembaga jasa keuangan mitra sesuai prosedur penilaian yang berlaku."
      },
      {
        no: "06",
        title: "Pembaruan Status & Tindak Lanjut",
        description:
          "Mengabarkan perkembangan proses dan menjaga komunikasi setelah pencairan sesuai ruang lingkup pendampingan."
      }
    ],
    disclaimer:
      "Kalkulator pada halaman ini menyajikan estimasi awal dan bukan persetujuan kredit yang mengikat. Keputusan persetujuan, margin atau suku bunga, ketentuan asuransi jiwa kredit, serta nominal terima bersih mengikuti analisis dan ketentuan Bank Mitra."
  },

  marketingCareers: {
    eyebrow: "Karir & Pengembangan Tim",
    headline: "Bertumbuh Bersama Jaringan Pemasaran PT KEN.",
    summary:
      "PT Kolaborasi Ekosistem Nusantara (KEN) membuka kesempatan berkarier bagi tenaga pemasaran di 7 Kantor Wilayah. Fokus kami bukan sekadar merekrut, melainkan membina etika kerja dan kompetensi pendampingan nasabah senior.",
    hrContactDisplay: "Peni • WhatsApp 0851 2114 2064",
    visionHeadline: "Sasaran Pembinaan 10.000 Mitra Pemasaran dalam 3 Tahun",
    visionNote:
      "Angka di atas adalah target strategis bertahap yang disesuaikan kapasitas pembinaan, mutu layanan, sistem kerja, dan kesiapan operasional, bukan proyeksi hasil yang dijamin.",
    stagedTargets: [
      {
        stage: "Tahun 1",
        target: "1.000",
        unit: "Mitra Terdaftar",
        focus: "Membangun fondasi rekrutmen, pembekalan awal, materi belajar, alur layanan, dan mentor perdana."
      },
      {
        stage: "Tahun 2",
        target: "4.000",
        unit: "Kumulatif Indikatif",
        focus: "Memperluas cakupan kota dan komunitas, memperkuat pimpinan cabang, coaching, serta kontrol mutu."
      },
      {
        stage: "Tahun 3",
        target: "10.000",
        unit: "Kumulatif Indikatif",
        focus: "Menyatukan jaringan multiwilayah, pemantauan kinerja, retensi mitra, dan kepemimpinan lapangan."
      }
    ],
    positions: [
      {
        title: "Marketing Officer Cabang",
        type: "Penempatan 29 Kota Cabang",
        scope:
          "Mendampingi nasabah pensiunan dan prapensiun sejak konsultasi awal, pengecekan berkas, hingga proses akad di Bank Mitra.",
        requirements: [
          "Komunikatif, sabar, jujur, dan terbiasa melayani nasabah usia senior",
          "Mengenal wilayah domisili dan disiplin menjaga kerahasiaan data pribadi",
          "Terbuka bagi pelamar berpengalaman di perbankan/kredit maupun kandidat yang siap dibina"
        ]
      },
      {
        title: "Sales Manager Wilayah",
        type: "Penempatan 7 Kantor Wilayah",
        scope:
          "Membimbing tim Marketing Officer cabang, menjaga kualitas prospek, etika komunikasi, serta ketertiban laporan wilayah.",
        requirements: [
          "Berpengalaman memimpin tim pemasaran kredit pensiun atau ritel perbankan",
          "Tegas menjaga standar pembinaan tim, kelengkapan berkas, dan kepuasan nasabah",
          "Memiliki jejaring aktif di komunitas pensiunan maupun instansi daerah"
        ]
      }
    ],
    advantages: [
      {
        no: "01",
        title: "Pembekalan Awal & Pelatihan Rutin",
        description:
          "Pendalaman produk, etika komunikasi lansia, perlindungan data, batas kewenangan, serta pendampingan rutin bersama mentor."
      },
      {
        no: "02",
        title: "Aplikasi Operasional Internal",
        description:
          "Tim dibekali sistem pencatatan prospek cabang, kalkulator simulasi, pemantauan status berkas, hingga pengajuan insentif."
      },
      {
        no: "03",
        title: "Skema Insentif Jelas & Tercatat",
        description:
          "Perhitungan pendapatan mengikuti aktivitas, ketentuan kemitraan, dan realisasi pencairan di Bank Mitra."
      }
    ]
  },

  investorRelations: {
    eyebrow: "Mitra Bank, Institusi & Investasi",
    headline: "Kemitraan Strategis Bersama PT Kolaborasi Ekosistem Nusantara.",
    summary:
      "Kami membuka ruang kerja sama jangka panjang bagi Bank Mitra, lembaga jasa keuangan, dan investor institusional. Kekuatan kami bertumpu pada distribusi lapangan, pembinaan SDM, sistem digital, dan tata kelola yang patuh.",
    irContactDisplay: "Peni • WhatsApp 0851 2114 2064",
    investmentDisclaimer:
      "PT Kolaborasi Ekosistem Nusantara (KEN) tidak menjanjikan hasil investasi tertentu. Halaman ini merupakan pengantar arah usaha, bukan penawaran efek atau jaminan imbal hasil. Setiap keputusan investasi membutuhkan uji tuntas (due diligence), data keuangan, kajian risiko, dan dokumen legal terverifikasi.",
    portfolioCaveat:
      "Daftar di atas merupakan arah pengembangan unit usaha bertahap sesuai kesiapan legal, perizinan, dan operasional. Tidak seluruh izin lintas sektor diklaim sudah berjalan saat ini.",
    ecosystemPortfolio: [
      {
        code: "FLAGSHIP",
        title: "Layanan Pensiunan",
        isFlagship: true,
        detail:
          "Prioritas utama perusahaan untuk layanan informasi, simulasi awal, administrasi, dan pemasaran kredit prapurnabakti serta purnabakti bersama bank mitra."
      },
      {
        code: "01",
        title: "Digital, Software & AI Solutions",
        isFlagship: false,
        detail:
          "Pengembangan sistem operasional, otomasi alur kerja, integrasi data, dan analitik penunjang layanan."
      },
      {
        code: "02",
        title: "Academy, Training & People Development",
        isFlagship: false,
        detail:
          "Pelatihan, coaching, pengembangan kompetensi, serta kepemimpinan jaringan agar mutu SDM tumbuh seiring skala usaha."
      },
      {
        code: "03",
        title: "Trading, Distribution & Procurement",
        isFlagship: false,
        detail:
          "Perdagangan, distribusi, dan dukungan pengadaan barang atau jasa bertahap sesuai kualifikasi dan hukum berlaku."
      },
      {
        code: "04",
        title: "Creative, Design & Project Services",
        isFlagship: false,
        detail:
          "Branding, komunikasi visual, desain ruang, dan koordinasi proyek sesuai kompetensi serta persyaratan perizinan."
      },
      {
        code: "05",
        title: "Furniture & Product Manufacturing",
        isFlagship: false,
        detail:
          "Perancangan, produksi, dan distribusi furnitur maupun produk terkait yang mengutamakan fungsi dan mutu."
      }
    ],
    growthStages: [
      {
        no: "01",
        name: "Establishment",
        detail: "Penuntasan legalitas, tata kelola, SOP, sistem keuangan, perlindungan data, dan standar kerja sama."
      },
      {
        no: "02",
        name: "Activation",
        detail: "Penguatan unit utama Layanan Pensiunan, perangkat digital, pelatihan tim, dan uji coba jaringan."
      },
      {
        no: "03",
        name: "Validation",
        detail: "Evaluasi retensi mitra, produktivitas cabang, mutu prospek, kepuasan nasabah, dan kendali risiko."
      },
      {
        no: "04",
        name: "Expansion",
        detail: "Perluasan wilayah, kemitraan bank, dan kapasitas usaha berdasarkan bukti kinerja lapangan."
      }
    ],
    pillars: [
      {
        no: "01",
        title: "Fokus Segmen Pensiun & Prapensiun",
        description:
          "Melayani pensiunan ASN, TNI/Polri, BUMN, dan pegawai aktif menjelang purnabakti dengan alur pendampingan yang sopan dan tertib."
      },
      {
        no: "02",
        title: "Sebaran Lapangan 7 Kanwil & 30 Titik Layanan",
        description:
          "Koordinasi di Sumatera, Jawa, Bali–Nusra, Kalimantan, hingga Sulawesi memadukan kemudahan akses web dengan pendampingan tatap muka."
      },
      {
        no: "03",
        title: "Sistem Digital Internal & Pembinaan Jaringan",
        description:
          "Aplikasi internal mencatat alur prospek, simulasi, kesiapan berkas, dan laporan cabang, ditopang pembinaan rutin bagi tim lapangan."
      },
      {
        no: "04",
        title: "Tata Kelola Patuh & Perlindungan Data (UU PDP)",
        description:
          "Seluruh kegiatan diselaraskan dengan kontrak mitra, pembatasan akses per peran (RBAC), jejak audit, serta perlindungan data pribadi."
      }
    ]
  },

  contact: {
    contactPerson: "Peni",
    whatsappDisplay: "0851 2114 2064 (Peni)",
    whatsappNumberE164: "6285121142064",
    whatsappHref: "https://wa.me/6285121142064",
    headOfficeShort: "Jl. Sisingamangaraja No. 11, Kota Pematangsiantar, Sumatera Utara",
    headOfficeAddress:
      "Sebelah Rumah Makan Mesran, Jalan Sisingamangaraja No. 11, Kel. Setia Negara, Kec. Siantar Sitalasari, Kota Pematangsiantar, Sumatera Utara 21137",
    googleMapsUrl: "https://share.google/nzDiL7ycohlFW2Ozh",
    operationalHours: "Senin – Jumat, 08.00 – 17.00 Waktu Setempat",
    partnerDisclosure:
      "Penyaluran pembiayaan dilaksanakan melalui Bank Mitra dan lembaga jasa keuangan berizin [KONFIRMASI PEMILIK: Daftar Nama Bank Mitra]."
  },

  kanwilList: [
    {
      code: "WIL-1",
      name: "Sumatera Bagian Utara",
      branches: ["MEDAN", "PEMATANGSIANTAR", "NIAS", "BANDA ACEH"]
    },
    {
      code: "WIL-2",
      name: "Sumatera Bagian Tengah & Selatan",
      branches: ["PEKANBARU", "PADANG", "PALEMBANG", "BANDAR LAMPUNG"]
    },
    {
      code: "WIL-3",
      name: "Jabodetabek & Banten",
      branches: ["PUSAT JAKARTA", "BOGOR", "TANGERANG", "BEKASI", "SERANG"]
    },
    {
      code: "WIL-4",
      name: "Jawa Barat",
      branches: ["BANDUNG", "CIREBON", "TASIKMALAYA", "SUKABUMI"]
    },
    {
      code: "WIL-5",
      name: "Jawa Tengah & D.I. Yogyakarta",
      branches: ["SEMARANG", "SOLO", "YOGYAKARTA", "PURWOKERTO"]
    },
    {
      code: "WIL-6",
      name: "Jawa Timur, Bali & Nusa Tenggara",
      branches: ["SURABAYA", "MALANG", "JEMBER", "DENPASAR", "MATARAM"]
    },
    {
      code: "WIL-7",
      name: "Kalimantan, Sulawesi & Indonesia Timur",
      branches: ["BALIKPAPAN", "BANJARMASIN", "MAKASSAR", "MANADO"]
    }
  ],

  education: {
    eyebrow: "Edukasi Pensiun & Prapensiun",
    headline: "Panduan Ringkas Sebelum Merencanakan Pembiayaan Pensiun.",
    summary:
      "Bacaan singkat berbahasa sederhana untuk membantu Bapak/Ibu dan keluarga memahami jenis layanan, hitungan terima bersih, hingga cara mengenali layanan aman sebelum memutuskan.",
    articles: [
      {
        id: "beda-pensiun-prapensiun-takeover",
        category: "Dasar Pembiayaan",
        title: "Apa Bedanya Kredit Pensiun Murni, Prapensiun, dan Take Over?",
        summary:
          "Kenali tiga jalur utama agar Bapak/Ibu memilih program yang pas dengan masa dinas saat ini.",
        points: [
          "Pensiun Murni: Untuk Bapak/Ibu yang sudah memegang SK Pensiun dan menerima gaji pensiun bulanan (TASPEN, ASABRI, atau Dapen BUMN), termasuk pensiun janda/duda.",
          "Prapensiun (Masih Aktif): Untuk ASN/PNS, TNI/Polri, dan pegawai BUMN aktif menjelang purnabakti. Skemanya mengikuti sisa bulan menuju Tanggal Mulai Pensiun (TMT), terutama sisa ≤ 3 tahun atau 3–10 tahun.",
          "Take Over (Penataan Cicilan): Cocok bila Bapak/Ibu masih memiliki potongan pinjaman lama dan ingin melunasinya agar cicilan bulanan kembali lega."
        ]
      },
      {
        id: "plafon-vs-terima-bersih",
        category: "Perhitungan Jelas",
        title: "Memahami Beda Plafon Pinjaman dan Uang Terima Bersih",
        summary:
          "Plafon yang disetujui bank tidak selalu sama persis dengan uang yang masuk ke rekening. Berikut potongan wajar yang perlu dipahami sejak awal.",
        points: [
          "Plafon Pinjaman adalah total pokok pembiayaan yang tertulis pada perjanjian akad bersama Bank Mitra.",
          "Uang Terima Bersih adalah nominal dana yang cair ke rekening tabungan Bapak/Ibu setelah dikurangi biaya baku bank seperti premi asuransi jiwa kredit, administrasi/provisi, blokir angsuran awal (bila disyaratkan), atau pelunasan pinjaman lama pada proses take over.",
          "Petugas cabang selalu menyerahkan lembar hitung terima bersih tertulis dan gratis sebelum Bapak/Ibu menyetujui pengajuan."
        ]
      },
      {
        id: "batas-aman-cicilan",
        category: "Keuangan Keluarga",
        title: "Menjaga Batas Aman Cicilan Agar Uang Pensiun Harian Tetap Lega",
        summary:
          "Pembiayaan yang baik bukan yang plafonnya paling besar, melainkan yang cicilannya tetap menyisakan uang cukup untuk belanja harian dan kesehatan.",
        points: [
          "Perhatikan angka 'Sisa Uang Pensiun di Tangan' setiap bulan sebelum menentukan jumlah dana.",
          "Untuk program Prapensiun, ingat bahwa uang pensiun setelah purnabakti umumnya lebih rendah dibanding gaji aktif. Sebaiknya cicilan tetap nyaman diukur terhadap perkiraan gaji pensiun.",
          "Bila estimasi cicilan terasa berat, Bapak/Ibu bisa menurunkan plafon atau memperpanjang tenor sesuai batas usia lunas bank."
        ]
      },
      {
        id: "asuransi-jiwa-kredit",
        category: "Perlindungan Keluarga",
        title: "Manfaat Perlindungan Asuransi Jiwa Kredit bagi Ahli Waris",
        summary:
          "Pertanyaan yang sering diajukan anak dan keluarga adalah bagaimana kelanjutan cicilan apabila terjadi risiko di tengah masa tenor.",
        points: [
          "Pembiayaan pensiun melalui Bank Mitra umumnya dilindungi Asuransi Jiwa Kredit sesuai syarat polis yang berlaku.",
          "Apabila nasabah wafat saat masa cicilan berjalan, sisa kewajiban pokok diselesaikan melalui klaim asuransi sehingga tidak membebani pasangan atau ahli waris.",
          "Petugas cabang menjelaskan cakupan dan syarat polis bank mitra secara rinci pada saat penjelasan akad."
        ]
      },
      {
        id: "ceklis-berkas-resmi",
        category: "Persiapan Dokumen",
        title: "Daftar Berkas yang Biasanya Disiapkan (Tanpa Unggah di Web)",
        summary:
          "Bapak/Ibu tidak perlu memotret atau mengunggah dokumen rahasia di situs ini. Berkas asli cukup ditunjukkan saat bertemu petugas cabang.",
        points: [
          "Identitas diri: e-KTP pemohon (dan pasangan bila menikah), Kartu Keluarga (KK), serta Buku Nikah atau Surat Keterangan Kematian pasangan untuk pensiun janda/duda.",
          "Dokumen pensiun atau dinas: SK Pensiun asli dan Karip (untuk Pensiun Murni), atau SK Pengangkatan/Pangkat terakhir beserta rincian gaji aktif (untuk Prapensiun).",
          "Rekening dan lainnya: Buku tabungan penerima gaji pensiun serta NPWP bila plafon melebihi ketentuan pajak bank."
        ]
      },
      {
        id: "ciri-resmi-vs-penipuan",
        category: "Keamanan Lansia",
        title: "5 Ciri Layanan Pembiayaan Pensiun Aman vs. Modus Penipuan",
        summary:
          "Lindungi keluarga dari pinjaman ilegal atau calo yang mengatasnamakan lembaga pembiayaan pensiun.",
        points: [
          "Tidak pernah meminta transfer uang muka (biaya admin, provisi, atau uang pelicin) ke rekening pribadi sebelum dana cair.",
          "Tidak pernah meminta kode OTP SMS/WhatsApp, PIN ATM, atau kata sandi mobile banking Bapak/Ibu.",
          "Pencairan dana selalu dikirim langsung oleh Bank Mitra ke rekening tabungan atas nama Bapak/Ibu sendiri.",
          "Didampingi tatap muka oleh petugas cabang dengan identitas dan alamat wilayah yang jelas (7 Kantor Wilayah & 30 Titik Layanan).",
          "Rincian angsuran dan uang terima bersih diserahkan tertulis sebelum Bapak/Ibu memutuskan."
        ]
      }
    ]
  },

  faqs: [
    {
      question: "Mengapa angka 'Uang Terima Bersih' dihitung oleh konsultan cabang?",
      answer:
        "Nominal dana bersih yang masuk ke rekening bergantung pada usia tepat Bapak/Ibu, tarif asuransi jiwa kredit, pilihan skema Bank Mitra (Syariah/Konvensional), serta sisa pelunasan lama bila take over. Petugas cabang menyusun rinciannya tertulis tanpa biaya."
    },
    {
      question: "Apakah pengajuan konsultasi dan simulasi ini dikenakan biaya?",
      answer:
        "Tidak ada biaya sama sekali. Bapak/Ibu bebas berdiskusi, meminta lembar simulasi, dan membandingkan opsi bersama keluarga tanpa kewajiban harus mengajukan pinjaman."
    },
    {
      question: "Apakah saya harus mengunggah foto KTP atau SK Pensiun di website ini?",
      answer:
        "Tidak perlu. Untuk menjaga keamanan data pribadi sesuai UU PDP, di halaman ini Bapak/Ibu cukup mengisi Nama, Nomor WhatsApp/HP, dan Kota Domisili."
    },
    {
      question: "Apakah PNS/ASN aktif yang baru akan pensiun (Prapensiun) bisa mengajukan?",
      answer:
        "Bisa. Ketuk pilihan 'Prapensiun (Masih Aktif)' pada kalkulator, lalu masukkan perkiraan tanggal pensiun (TMT). Kami mendampingi pegawai aktif usia 50–59 tahun, pensiun murni, maupun pensiun janda/duda."
    }
  ]
};

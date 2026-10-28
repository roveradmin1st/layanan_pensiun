// ============================================================================
// DEFAULT PARAMETERS & MASTER DATA — LAYANAN PENSIUNAN ENTERPRISE PLATFORM
// Seluruh parameter mitra bank di bawah ini bersifat DINAMIS dan dapat di-edit
// oleh Super Admin (atau diusulkan oleh Admin Operasional melalui Dual Control)
// ============================================================================

window.DEFAULT_PARTNER_PARAMETERS = {
  version: "2.5.0-ENTERPRISE",
  lastUpdated: "2026-10-27T00:45:00+07:00",
  updatedBy: "MUHAMMAD TEGUH PRANADA (Super Admin)",

  // --------------------------------------------------------------------------
  // 1. KOPERASI ASIA MADANI SEJAHTERA (AMS2 — FUNDBANK PLATINUM SERIES)
  // --------------------------------------------------------------------------
  ams2: {
    id: "ams2",
    code: "AMS2",
    name: "Koperasi Asia Madani Sejahtera (AMS2)",
    shortName: "AMS2 · Platinum",
    type: "koperasi_fundbank",
    engine: "ams2",
    active: true,
    badgeColor: "purple",
    description: "Program Kredit Pensiun Pra Platinum, Platinum, dan Post Platinum dengan perhitungan Anuitas PV/PMT, BAA, Cadangan Risiko, Tata Laksana, dan Retensi.",
    picDefault: "MUHAMMAD TEGUH PRANADA",
    bankRateAnnual: 12.0,          // Bunga Bank 12% per tahun
    maxInstallmentRatio: 95.0,     // Maksimal rasio angsuran 95% dari gaji
    maxPlafondAbsolute: 250000000, // Plafond maksimal absolut Rp250.000.000
    maxTenorMonths: 120,           // Tenor maksimal 120 bulan (10 tahun)
    maxEndAgeYears: 84,            // Batas usia akhir kredit: 84 tahun
    maxEndAgeMonths: 10,           // 10 bulan (berlaku untuk seluruh produk)
    maxEntryAgeYears: 84,          // Usia >= 85 tahun tidak dapat diproses
    proaqRate: 10.0,               // Biaya PROAQ 10% dari plafond
    adminFee: 700000,              // Biaya Administrasi Rp700.000
    tataLaksanaMin: 0.0,           // Tata Laksana minimum 0%
    tataLaksanaMax: 3.5,           // Tata Laksana maksimum 3,5%
    tataLaksanaDefault: 3.5,       // Default input Tata Laksana 3,5%
    retentionMultiplier: 3,        // Retensi Angsuran = 3x angsuran koperasi aktual
    plafondRoundingStep: 1,        // Pembulatan ke bawah ke rupiah penuh sesuai command.md
    tiers: [
      {
        id: "pra_platinum",
        name: "Pra Platinum",
        minAge: 0,
        maxAge: 75,
        coopRateAnnual: 17.0,
        riskReserveRate: 20.0
      },
      {
        id: "platinum",
        name: "Platinum",
        minAge: 76,
        maxAge: 80,
        coopRateAnnual: 19.0,
        riskReserveRate: 25.0
      },
      {
        id: "post_platinum",
        name: "Post Platinum",
        minAge: 81,
        maxAge: 84,
        coopRateAnnual: 21.0,
        riskReserveRate: 30.0
      }
    ],
    mandatoryDocs: [
      { id: "ktp_pasangan", label: "KTP Nasabah & Suami/Istri", required: true },
      { id: "nikah_kematian", label: "Buku Nikah / Akta Kematian", required: true },
      { id: "kk", label: "Kartu Keluarga (KK)", required: true },
      { id: "taspen", label: "Kartu Identitas Pensiun / Taspen / Asabri", required: true },
      { id: "sk", label: "Surat Keputusan (SK) Pensiun Asli/Salinan", required: true },
      { id: "rekening", label: "Cetak Buku Tabungan / Rekening Koran 3 Bulan Terakhir", required: true },
      { id: "ktp_ahliwaris", label: "KTP Ahli Waris", required: true },
      { id: "kk_ahliwaris", label: "Kartu Keluarga (KK) Ahli Waris", required: true }
    ]
  },

  // --------------------------------------------------------------------------
  // 2. BANK SYARIAH INDONESIA (BSI — PRAPENSIUN NOS MITRAGUNA PRIMA+ & SIMAS)
  // --------------------------------------------------------------------------
  bsi_prapen: {
    id: "bsi_prapen",
    code: "BSI-PRAPEN",
    name: "BSI — Mitraguna Prima+ Prapensiun (Dekade & Tri Berkah)",
    shortName: "BSI · Prapensiun",
    type: "bank_syariah_prapen",
    engine: "bsi_simas",
    active: true,
    badgeColor: "teal",
    description: "Kalkulator Resmi NOS v1.4.6 BSI Prapensiun (Dekade Berkah 10 Tahun & Tri Berkah 3 Tahun) Akad MMQ & Murabahah terintegrasi otomatis dengan Asuransi Jiwa Simas Prapensiun.",
    maxPlafondAbsolute: 800000000, // Maksimal Plafond Pembiayaan Rp800.000.000
    maxTenorMonths: 180,           // Tenor maksimal 180 bulan (15 tahun)
    maxEndAgeYears: 74,            // Setting usia jatuh tempo maks 74 tahun
    maxEndAgeMonths: 4,            // 4 bulan
    bupAgeDefault: 58,             // Default usia BUP PNS (58 atau 60 tahun)
    incomeWeights: {
      gajiPokok: 100.0,            // 100% Gaji Pokok
      uangMakan: 90.0,             // 90% Uang Makan
      tunjanganRutin1Bln: 90.0,    // 90% Tunjangan Rutin per 1 Bulan
      tunjanganRutin3Bln: 50.0,    // 50% Tunjangan Rutin per 3 Bulan
      tunjanganLain1Bln: 80.0,     // 80% Tunjangan Lain Rutin per 1 Bulan
      tht: 75.0                    // 75% THT
    },
    dbrActivePayroll: 70.0,        // DBR Saat Aktif Payroll 70%
    dbrActivePayrollColek: 80.0,   // Status C 80%
    dbrActiveNonPayroll: 50.0,     // DBR Non-Payroll 50%
    dsrPensionMax: 90.0,           // DSR Saat Pensiun 90% dari Manfaat Pensiun
    pricingTiers: {
      triNettAbove200: {
        label: "Tri Berkah (PP3) Nett ≥ Rp200 Juta",
        rateActiveAnnual: 9.25,
        ratePensionAnnual: 10.50
      },
      dekadeNettAbove200: {
        label: "Dekade Berkah (PP10) Nett ≥ Rp200 Juta",
        rateActiveAnnual: 9.50,
        ratePensionAnnual: 10.50
      },
      below200: {
        label: "Plafond < Rp200 Juta",
        rateActiveAnnual: 10.50,
        ratePensionAnnual: 11.50
      }
    },
    atribusiAdjustments: {
      pp10ActiveRateAdd: 0.10,     // +0.001 (0.1%) di NOS untuk aktif PP10
      pp10PensionRateAdd: 1.00,    // +0.01 (1.0%) di NOS untuk pensiun PP10
      pp10AtribExtraActive: 1.00,  // +1.0% skema atribusi aktif
      pp3PokokTetapAktif: 10000    // Angsuran pokok tetap saat aktif PP3 Rp10.000
    },
    fees: {
      adminRatePercent: 1.0,       // Biaya Administrasi 1% dari Plafond
      materaiFee: 100000,          // Biaya Materai Rp100.000
      taksasiMmqMarkupPercent: 2.0,// Estimasi Taksasi MMQ = Plafond + 2% (dibulatkan ke atas per juta)
      blokirActiveCount: 1,        // Blokir 1x Angsuran Masa Aktif
      blokirPensionCount: 2        // Blokir 2x Angsuran Masa Pensiun
    },
    // Spesifikasi & Tabel Tarif Resmi PT Asuransi Simas Jiwa (Simas Prapensiun)
    simasInsurance: {
      companyName: "PT Asuransi Simas Jiwa",
      distributionChannel: "Syariah",
      minEntryAge: 45,
      maxEntryAge: 65,
      maxCoverageAge: 75,
      maxInsuranceYears: 20,
      maxUpAge70: 1000000000,      // x + n <= 70 tahun -> Maks UP Rp1 Miliar
      maxUpAge75: 500000000,       // x + n > 70 s.d. 75 tahun -> Maks UP Rp500 Juta
      monthMultipliers: {
        1: 0.2, 2: 0.3, 3: 0.4, 4: 0.5, 5: 0.6,
        6: 0.7, 7: 0.75, 8: 0.875, 9: 1.0, 10: 1.0, 11: 1.0, 12: 1.0
      },
      // Tabel Tarif Kontribusi (per mil / ‰) UP Menurun untuk usia 45 s.d. 65 (Masa Asuransi 1 s.d. 20 tahun)
      decreasingRateTable: {
        45: [3.6, 6.52, 9.28, 12.08, 15.03, 18.24, 21.35, 24.37, 28.02, 31.59, 35.15, 38.24, 41.92, 45.74, 49.54, 53.6, 57.11, 60.6, 64.08, 67.56],
        46: [3.87, 7.08, 10.09, 13.18, 16.35, 19.79, 23.11, 26.73, 30.37, 34.19, 38.03, 41.6, 45.57, 49.64, 53.72, 58.12, 61.93, 65.72, 69.49, 73.24],
        47: [4.18, 7.73, 11.01, 14.38, 17.83, 21.57, 25.16, 28.87, 33.36, 37.15, 41.29, 45.16, 49.43, 53.79, 58.17, 62.94, 67.06, 71.15, 75.22, 79.27],
        48: [4.52, 8.43, 12.0, 15.69, 19.46, 23.52, 27.67, 31.68, 35.95, 40.33, 44.76, 48.93, 53.5, 58.2, 62.92, 68.09, 72.53, 76.94, 81.32, 85.67],
        49: [4.87, 9.16, 13.05, 17.12, 21.17, 25.52, 29.94, 34.74, 38.96, 43.63, 48.43, 53.23, 58.17, 63.16, 68.23, 73.83, 78.66, 83.44, 88.19, 92.88],
        50: [5.25, 10.0, 14.24, 18.68, 23.09, 27.81, 32.6, 37.53, 42.8, 47.42, 52.57, 57.78, 63.09, 68.43, 73.88, 79.96, 85.17, 90.34, 95.46, 100.52],
        51: [5.69, 10.91, 15.53, 20.39, 25.2, 30.32, 35.84, 41.17, 46.13, 51.48, 57.0, 62.61, 68.3, 74.05, 79.91, 86.5, 92.13, 97.7, 103.21, 108.64],
        52: [6.19, 11.91, 16.95, 22.25, 27.47, 33.02, 38.67, 44.32, 49.96, 55.76, 61.68, 67.69, 73.8, 80.0, 86.28, 93.38, 99.45, 105.41, 111.32, 117.14],
        53: [6.75, 13.01, 18.51, 24.25, 29.9, 35.86, 41.86, 47.9, 54.01, 60.23, 66.56, 73.02, 79.59, 86.26, 93.03, 100.65, 107.14, 113.53, 119.84, 126.05],
        54: [7.39, 14.18, 20.14, 26.35, 32.41, 38.78, 45.18, 51.63, 58.17, 64.82, 71.61, 78.56, 85.65, 92.84, 100.1, 108.28, 115.2, 122.04, 128.77, 135.39],
        55: [8.08, 15.39, 21.81, 28.46, 34.91, 41.68, 48.5, 55.37, 62.35, 69.49, 76.82, 84.31, 91.95, 99.68, 107.5, 116.24, 123.62, 130.9, 138.07, 145.11],
        56: [8.84, 16.59, 23.44, 30.51, 37.32, 44.5, 51.74, 59.08, 66.59, 74.29, 82.18, 90.26, 98.49, 106.82, 115.08, 124.38, 132.24, 139.98, 147.59, 0],
        57: [9.61, 17.69, 24.96, 32.43, 39.6, 47.2, 54.92, 62.81, 70.91, 79.23, 87.78, 96.49, 105.34, 114.27, 123.31, 133.21, 141.58, 149.8, 0, 0],
        58: [10.45, 18.71, 26.37, 34.23, 41.81, 49.9, 58.21, 66.72, 75.5, 84.5, 93.73, 103.12, 112.66, 122.29, 131.98, 142.54, 151.44, 0, 0, 0],
        59: [11.35, 19.67, 27.74, 36.01, 44.1, 52.81, 61.78, 71.02, 80.52, 90.27, 100.23, 110.37, 120.64, 130.99, 141.43, 152.68, 0, 0, 0, 0],
        60: [12.34, 20.64, 29.13, 37.98, 46.71, 56.14, 65.88, 75.91, 86.2, 96.76, 107.52, 118.44, 129.5, 140.65, 151.87, 0, 0, 0, 0, 0],
        61: [13.45, 21.66, 30.78, 40.36, 49.86, 60.12, 70.69, 81.58, 92.75, 104.16, 115.78, 127.56, 139.49, 151.49, 0, 0, 0, 0, 0, 0],
        62: [14.7, 23.02, 32.98, 43.42, 53.77, 64.94, 76.45, 88.27, 100.36, 112.7, 125.24, 137.96, 150.82, 0, 0, 0, 0, 0, 0, 0],
        63: [16.11, 25.13, 36.02, 47.44, 58.73, 70.88, 83.37, 96.17, 109.26, 122.6, 136.15, 149.89, 0, 0, 0, 0, 0, 0, 0, 0],
        64: [17.69, 27.78, 39.78, 51.92, 64.22, 77.42, 90.96, 104.83, 118.97, 133.4, 148.05, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        65: [19.42, 30.25, 43.27, 56.78, 70.14, 84.45, 99.12, 114.12, 129.45, 145.05, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      }
    }
  },

  // --------------------------------------------------------------------------
  // 3. MITRA BANK LAINNYA (DAPAT DIKONFIGURASI PENUH OLEH SUPER ADMIN)
  // --------------------------------------------------------------------------
  bank_capital: {
    id: "bank_capital",
    code: "CAPITAL-ALADIN",
    name: "Bank Capital / Aladin — Kredit Pensiun",
    shortName: "Capital / Aladin",
    type: "bank_konvensional",
    engine: "partner_bank",
    active: true,
    badgeColor: "orange",
    description: "Skema Kredit Pensiun & Take Over Bank Capital / Aladin dengan parameter bunga, DSR, dan biaya yang fleksibel.",
    interestRateAnnual: 13.5,
    interestMethod: "annuity",
    maxInstallmentRatio: 90.0,
    maxPlafondAbsolute: 300000000,
    maxTenorMonths: 180,
    maxEndAgeYears: 80,
    maxEndAgeMonths: 0,
    maxEntryAgeYears: 78,
    provisionRatePercent: 1.5,
    insuranceRatePercent: 12.0,
    adminFee: 500000,
    tataLaksanaRatePercent: 1.5,
    retentionMultiplier: 2
  },

  bank_mantap: {
    id: "bank_mantap",
    code: "MANDIRI-TASPEN",
    name: "Bank Mandiri Taspen (Mantap) — Pensiun Sejahtera",
    shortName: "Mandiri Taspen",
    type: "bank_konvensional",
    engine: "partner_bank",
    active: true,
    badgeColor: "purple",
    description: "Fasilitas Kredit Pensiun & Prapensiun Bank Mandiri Taspen dengan tenor hingga 15 tahun.",
    interestRateAnnual: 11.5,
    interestMethod: "annuity",
    maxInstallmentRatio: 90.0,
    maxPlafondAbsolute: 500000000,
    maxTenorMonths: 180,
    maxEndAgeYears: 75,
    maxEndAgeMonths: 0,
    maxEntryAgeYears: 74,
    provisionRatePercent: 1.0,
    insuranceRatePercent: 9.5,
    adminFee: 350000,
    tataLaksanaRatePercent: 0.0,
    retentionMultiplier: 2
  },

  bank_mnc: {
    id: "bank_mnc",
    code: "BANK-MNC",
    name: "Bank MNC — Kredit Pensiun",
    shortName: "Bank MNC",
    type: "bank_konvensional",
    engine: "partner_bank",
    active: true,
    badgeColor: "teal",
    description: "Program Pembiayaan Pensiunan Bank MNC untuk nasabah Taspen & Asabri.",
    interestRateAnnual: 14.0,
    interestMethod: "annuity",
    maxInstallmentRatio: 90.0,
    maxPlafondAbsolute: 250000000,
    maxTenorMonths: 120,
    maxEndAgeYears: 80,
    maxEndAgeMonths: 0,
    maxEntryAgeYears: 78,
    provisionRatePercent: 2.0,
    insuranceRatePercent: 13.5,
    adminFee: 600000,
    tataLaksanaRatePercent: 2.0,
    retentionMultiplier: 2
  },

  bank_bni: {
    id: "bank_bni",
    code: "BNI-FLEKSI",
    name: "Bank BNI — BNI Fleksi Pensiun",
    shortName: "Bank BNI",
    type: "bank_konvensional",
    engine: "partner_bank",
    active: true,
    badgeColor: "green",
    description: "Kredit lunak BNI Fleksi Pensiun & Prapensiun dengan suku bunga kompetitif.",
    interestRateAnnual: 10.75,
    interestMethod: "annuity",
    maxInstallmentRatio: 85.0,
    maxPlafondAbsolute: 500000000,
    maxTenorMonths: 180,
    maxEndAgeYears: 75,
    maxEndAgeMonths: 0,
    maxEntryAgeYears: 73,
    provisionRatePercent: 1.0,
    insuranceRatePercent: 8.5,
    adminFee: 250000,
    tataLaksanaRatePercent: 0.0,
    retentionMultiplier: 1
  },

  bank_mestika: {
    id: "bank_mestika",
    code: "BANK-MESTIKA",
    name: "Bank Mestika — Kredit Pensiun",
    shortName: "Bank Mestika",
    type: "bank_konvensional",
    engine: "partner_bank",
    active: true,
    badgeColor: "orange",
    description: "Pembiayaan Pensiun & Take Over wilayah Sumatera Utara dan sekitarnya.",
    interestRateAnnual: 13.0,
    interestMethod: "annuity",
    maxInstallmentRatio: 90.0,
    maxPlafondAbsolute: 300000000,
    maxTenorMonths: 144,
    maxEndAgeYears: 78,
    maxEndAgeMonths: 0,
    maxEntryAgeYears: 76,
    provisionRatePercent: 1.5,
    insuranceRatePercent: 11.0,
    adminFee: 500000,
    tataLaksanaRatePercent: 1.0,
    retentionMultiplier: 2
  }
};

// ----------------------------------------------------------------------------
// DATA WILAYAH 38 PROVINSI INDONESIA
// ----------------------------------------------------------------------------
window.INDONESIA_WILAYAH = {
  "Aceh": ["Kabupaten Aceh Barat", "Kabupaten Aceh Besar", "Kabupaten Aceh Selatan", "Kabupaten Aceh Tamiang", "Kota Banda Aceh", "Kota Langsa", "Kota Lhokseumawe", "Kota Sabang", "Kota Subulussalam"],
  "Sumatera Utara": ["Kabupaten Asahan", "Kabupaten Batu Bara", "Kabupaten Dairi", "Kabupaten Deli Serdang", "Kabupaten Humbang Hasundutan", "Kabupaten Karo", "Kabupaten Labuhanbatu", "Kabupaten Langkat", "Kabupaten Mandailing Natal", "Kabupaten Serdang Bedagai", "Kabupaten Simalungun", "Kabupaten Tapanuli Selatan", "Kabupaten Tapanuli Tengah", "Kabupaten Tapanuli Utara", "Kabupaten Toba", "Kota Binjai", "Kota Gunungsitoli", "Kota Medan", "Kota Padangsidimpuan", "Kota Pematangsiantar", "Kota Sibolga", "Kota Tanjungbalai", "Kota Tebing Tinggi"],
  "Sumatera Barat": ["Kabupaten Agam", "Kabupaten Lima Puluh Kota", "Kabupaten Padang Pariaman", "Kabupaten Tanah Datar", "Kota Bukittinggi", "Kota Padang", "Kota Payakumbuh", "Kota Solok"],
  "Riau": ["Kabupaten Bengkalis", "Kabupaten Indragiri Hilir", "Kabupaten Kampar", "Kabupaten Rokan Hilir", "Kabupaten Siak", "Kota Dumai", "Kota Pekanbaru"],
  "Kepulauan Riau": ["Kabupaten Bintan", "Kabupaten Karimun", "Kota Batam", "Kota Tanjungpinang"],
  "Jambi": ["Kabupaten Batanghari", "Kabupaten Muaro Jambi", "Kabupaten Sarolangun", "Kota Jambi", "Kota Sungai Penuh"],
  "Sumatera Selatan": ["Kabupaten Banyuasin", "Kabupaten Lahat", "Kabupaten Muara Enim", "Kabupaten Ogan Komering Ilir", "Kota Lubuklinggau", "Kota Pagar Alam", "Kota Palembang", "Kota Prabumulih"],
  "Kepulauan Bangka Belitung": ["Kabupaten Bangka", "Kabupaten Belitung", "Kota Pangkalpinang"],
  "Bengkulu": ["Kabupaten Bengkulu Utara", "Kabupaten Rejang Lebong", "Kota Bengkulu"],
  "Lampung": ["Kabupaten Lampung Selatan", "Kabupaten Lampung Tengah", "Kabupaten Lampung Utara", "Kota Bandar Lampung", "Kota Metro"],
  "DKI Jakarta": ["Kabupaten Administrasi Kepulauan Seribu", "Kota Administrasi Jakarta Barat", "Kota Administrasi Jakarta Pusat", "Kota Administrasi Jakarta Selatan", "Kota Administrasi Jakarta Timur", "Kota Administrasi Jakarta Utara"],
  "Banten": ["Kabupaten Lebak", "Kabupaten Pandeglang", "Kabupaten Serang", "Kabupaten Tangerang", "Kota Cilegon", "Kota Serang", "Kota Tangerang", "Kota Tangerang Selatan"],
  "Jawa Barat": ["Kabupaten Bandung", "Kabupaten Bekasi", "Kabupaten Bogor", "Kabupaten Cianjur", "Kabupaten Cirebon", "Kabupaten Garut", "Kabupaten Karawang", "Kabupaten Sukabumi", "Kota Bandung", "Kota Bekasi", "Kota Bogor", "Kota Cimahi", "Kota Cirebon", "Kota Depok", "Kota Sukabumi", "Kota Tasikmalaya"],
  "Jawa Tengah": ["Kabupaten Banyumas", "Kabupaten Cilacap", "Kabupaten Klaten", "Kabupaten Magelang", "Kabupaten Pati", "Kabupaten Semarang", "Kabupaten Tegal", "Kota Magelang", "Kota Pekalongan", "Kota Salatiga", "Kota Semarang", "Kota Surakarta", "Kota Tegal"],
  "DI Yogyakarta": ["Kabupaten Bantul", "Kabupaten Gunungkidul", "Kabupaten Kulon Progo", "Kabupaten Sleman", "Kota Yogyakarta"],
  "Jawa Timur": ["Kabupaten Banyuwangi", "Kabupaten Gresik", "Kabupaten Jember", "Kabupaten Kediri", "Kabupaten Malang", "Kabupaten Sidoarjo", "Kota Batu", "Kota Blitar", "Kota Kediri", "Kota Madiun", "Kota Malang", "Kota Mojokerto", "Kota Pasuruan", "Kota Probolinggo", "Kota Surabaya"],
  "Bali": ["Kabupaten Badung", "Kabupaten Buleleng", "Kabupaten Gianyar", "Kabupaten Tabanan", "Kota Denpasar"],
  "Nusa Tenggara Barat": ["Kabupaten Bima", "Kabupaten Lombok Barat", "Kabupaten Lombok Tengah", "Kabupaten Lombok Timur", "Kabupaten Sumbawa", "Kota Bima", "Kota Mataram"],
  "Nusa Tenggara Timur": ["Kabupaten Ende", "Kabupaten Manggarai Barat", "Kabupaten Sikka", "Kota Kupang"],
  "Kalimantan Barat": ["Kabupaten Kubu Raya", "Kabupaten Sambas", "Kabupaten Sintang", "Kota Pontianak", "Kota Singkawang"],
  "Kalimantan Tengah": ["Kabupaten Kapuas", "Kabupaten Kotawaringin Barat", "Kabupaten Kotawaringin Timur", "Kota Palangka Raya"],
  "Kalimantan Selatan": ["Kabupaten Banjar", "Kabupaten Tanah Laut", "Kota Banjarbaru", "Kota Banjarmasin"],
  "Kalimantan Timur": ["Kabupaten Berau", "Kabupaten Kutai Kartanegara", "Kota Balikpapan", "Kota Bontang", "Kota Samarinda"],
  "Kalimantan Utara": ["Kabupaten Bulungan", "Kabupaten Nunukan", "Kota Tarakan"],
  "Sulawesi Utara": ["Kabupaten Minahasa", "Kabupaten Minahasa Utara", "Kota Bitung", "Kota Kotamobagu", "Kota Manado", "Kota Tomohon"],
  "Gorontalo": ["Kabupaten Bone Bolango", "Kabupaten Gorontalo", "Kota Gorontalo"],
  "Sulawesi Tengah": ["Kabupaten Banggai", "Kabupaten Donggala", "Kabupaten Poso", "Kota Palu"],
  "Sulawesi Selatan": ["Kabupaten Bone", "Kabupaten Gowa", "Kabupaten Maros", "Kabupaten Wajo", "Kota Makassar", "Kota Palopo", "Kota Parepare"],
  "Sulawesi Tenggara": ["Kabupaten Kolaka", "Kabupaten Konawe", "Kota Baubau", "Kota Kendari"],
  "Sulawesi Barat": ["Kabupaten Majene", "Kabupaten Mamuju", "Kabupaten Polewali Mandar"],
  "Maluku": ["Kabupaten Maluku Tengah", "Kota Ambon", "Kota Tual"],
  "Maluku Utara": ["Kabupaten Halmahera Utara", "Kota Ternate", "Kota Tidore Kepulauan"],
  "Papua": ["Kabupaten Biak Numfor", "Kabupaten Jayapura", "Kota Jayapura"],
  "Papua Barat": ["Kabupaten Fakfak", "Kabupaten Manokwari"],
  "Papua Selatan": ["Kabupaten Asmat", "Kabupaten Boven Digoel", "Kabupaten Mappi", "Kabupaten Merauke"],
  "Papua Tengah": ["Kabupaten Mimika", "Kabupaten Nabire", "Kabupaten Puncak Jaya"],
  "Papua Pegunungan": ["Kabupaten Jayawijaya", "Kabupaten Yahukimo"],
  "Papua Barat Daya": ["Kabupaten Sorong", "Kota Sorong"]
};

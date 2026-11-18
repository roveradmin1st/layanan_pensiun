// ============================================================================
// KONFIGURASI PRODUK & TABEL AKTUARIA BANK BNI FLEKSI PENSIUN (MKSA v4 Jul26)
// Sumber referensi pasif: Kalkulator BNI MKSA  v4_Jul26.xlsx
// Catatan:
// - Mendukung penuh Produk 1 (BNI Fleksi Reguler) dan Produk 4 (BNI Fleksi Pra Purna)
//   pada Skema Asuransi "Kredit BFP Skema Menurun" (CAR / AJK UP MENURUN BFP REG)
//   untuk tenor 1-180 bulan (kecuali tenor 133-144 bln pada Produk 1 karena tumpang
//   tindih rentang bunga di Excel).
// - Kombinasi/produk yang belum terkonfirmasi mengembalikan status UNAVAILABLE
//   beserta sumber sheet/sel dan kebijakan yang menunggu konfirmasi klien.
// ============================================================================

export const BNI_SCHEMA_VERSION = 1;
export const BNI_POLICY_VERSION = "bni-fleksi-jul26-v1";
export const BNI_SUBSIDY_PERMIL = 150;
export const BNI_MAX_AGE_LIMIT_YEARS = 75;
export const BNI_CONFIRMED_MAX_TENOR_MONTHS = 180;
export const BNI_UNDERWRITING_MAX_PLAFOND = 10000000000;
export const BNI_DBR_PRESETS = [90, 85, 80, 70];
export const BNI_UNDERWRITING_REVIEW_MESSAGE = "Perlu verifikasi aturan asuransi. Kategori berdasarkan tabel usia berbeda dari hasil rumus Excel.";

export const BNI_PRODUCT_DEFINITIONS = {
  "1": {
    code: "1",
    name: "BNI Fleksi Reguler",
    shortLabel: "1 - BNI Fleksi Reguler (Purna)",
    supported: true,
    rateColumn: "purnaRate",
    adminFee: 80000,
    provisiPercent: 0.2,
    btlPercent: 3.5,
    totalFeePercent: 3.7,
    defaultBlokirAngsuran: 3,
    defaultBlokirTabungan: 1,
    defaultBlokirPrapensiun: 0,
    maxTenorConfirmed: 180,
    sourceCells: "Kalkulator!D14=1, J13:K13, B29, D29, L52:O61 (kolom O)"
  },
  "2": {
    code: "2",
    name: "BNI Fleksi Grace Period",
    shortLabel: "2 - BNI Fleksi Grace Period (Belum Tersedia)",
    supported: false,
    unavailableReason:
      "Produk Kode 2 (BNI Fleksi Grace Period) belum tersedia karena inkonsistensi di workbook Excel sumber: lookup Kalkulator!J13:K16 tidak memuat Kode 2 (terletak di luar rentang J21:K21, validasi D14 hanya J13:J14 sehingga D15=#N/A), rumus biaya Kalkulator!D29 menghasilkan FALSE untuk D14=2 (berbeda dengan Simulasi Asuransi!D23), serta ketentuan skema Grace Period Murni menunggu konfirmasi resmi klien.",
    sourceCells: "Kalkulator!D14, D15, J13:K16, J21:K21, D29; Simulasi Asuransi!D23"
  },
  "3": {
    code: "3",
    name: "BNI Fleksi Grace Period Kombinasi",
    shortLabel: "3 - BNI Fleksi Grace Period Kombinasi (Belum Tersedia)",
    supported: false,
    unavailableReason:
      "Produk Kode 3 (BNI Fleksi Grace Period Kombinasi) belum tersedia karena aturan di workbook Excel saling bertentangan: batas tenor berbeda antar sheet (Kalkulator!N33 menyebut 1-6 thn, Kalkulator!D28 membatasi 180 bln, sementara Simulasi Asuransi!H12 & Sheet1!E7 menyebut 240 bln), rumus biaya Kalkulator!D29 menghasilkan FALSE untuk D14=3, header tabel AJK UP MENURUN BFP GP KOMB!B1 dimulai dari tahun ke-2 (pergeseran +1 tahun pada B62), dan Kalkulator!BN42:BN43 salah merujuk sel B66/B67.",
    sourceCells: "Kalkulator!D28, D29, N33, BN41:BN43; AJK UP MENURUN BFP GP KOMB!B1, B62; Simulasi Asuransi!H12; Sheet1!E7"
  },
  "4": {
    code: "4",
    name: "BNI Fleksi Pra Purna",
    shortLabel: "4 - BNI Fleksi Pra Purna",
    supported: true,
    rateColumn: "praPurnaRate",
    adminFee: 150000,
    provisiPercent: 1.0,
    btlPercent: 3.5,
    totalFeePercent: 4.5,
    defaultBlokirAngsuran: 3,
    defaultBlokirTabungan: 1,
    defaultBlokirPrapensiun: 10,
    maxTenorConfirmed: 180,
    sourceCells: "Kalkulator!D14=4, J14:K14, B29, D29, C40:C42, L52:N61 (kolom N)"
  }
};

export const BNI_INSURANCE_SCHEMES = {
  MENURUN: {
    code: "MENURUN",
    label: "Kredit BFP Skema Menurun",
    supported: true,
    underwriter: "CAR (PT AJ Central Asia Raya)",
    tableSheet: "AJK UP MENURUN BFP REG",
    ageMin: 20,
    ageMax: 74,
    tenorYearsMin: 1,
    tenorYearsMax: 20
  },
  IBR: {
    code: "IBR",
    label: "Kredit BFP Skema Interest Before Retirement (IBR)",
    supported: false,
    unavailableReason:
      "Skema asuransi IBR belum tersedia karena tabel AJK UP TURUN IBR memiliki pergeseran header kolom (B1=2 tahun pada VLOOKUP B62) dan konfirmasi kebijakan produk IBR dari klien belum tersedia.",
    tableSheet: "AJK UP TURUN IBR"
  },
  GP_MURNI: {
    code: "GP_MURNI",
    label: "Kredit BFP Skema Grace Period Murni",
    supported: false,
    unavailableReason:
      "Skema asuransi Grace Period Murni belum tersedia karena produk Grace Period (Kode 2) dan ketentuan biaya/tenornya belum terkonfirmasi oleh klien.",
    tableSheet: "AJK UP GP MURNI"
  },
  GP_KOMBINASI: {
    code: "GP_KOMBINASI",
    label: "Kredit BFP Skema Grace Period Kombinasi",
    supported: false,
    unavailableReason:
      "Skema asuransi Grace Period Kombinasi belum tersedia karena konflik batas tenor (6 thn vs 15 thn vs 20 thn), pergeseran kolom B1=2 pada AJK UP MENURUN BFP GP KOMB, serta bug referensi sel Kalkulator!BN42:BN43.",
    tableSheet: "AJK UP MENURUN BFP GP KOMB"
  }
};

// Tabel Suku Bunga Efektif per Tahun (% p.a.) dari Kalkulator!L52:O61
// Catatan:
// - L59:M59 = 121-144 (Pra Purna 10.85%, Purna 12.00%)
// - L60:M60 = 133-168 (Pra Purna 10.85%, Purna 12.10%)
// Akibatnya bulan 133-144 tumpang tindih pada Produk 1 (Purna: 12.00% vs 12.10%),
// sedangkan Produk 4 (Pra Purna: 10.85% pada kedua baris) tetap konsisten 10.85%.
export const BNI_INTEREST_RATE_TIERS = [
  { minMonths: 1, maxMonths: 12, praPurnaRate: 9.75, purnaRate: 11.0, excelRow: 52 },
  { minMonths: 13, maxMonths: 24, praPurnaRate: 10.3, purnaRate: 11.8, excelRow: 53 },
  { minMonths: 25, maxMonths: 36, praPurnaRate: 10.3, purnaRate: 11.8, excelRow: 54 },
  { minMonths: 37, maxMonths: 48, praPurnaRate: 10.5, purnaRate: 11.8, excelRow: 55 },
  { minMonths: 49, maxMonths: 60, praPurnaRate: 10.5, purnaRate: 11.8, excelRow: 56 },
  { minMonths: 61, maxMonths: 96, praPurnaRate: 10.85, purnaRate: 12.0, excelRow: 57 },
  { minMonths: 97, maxMonths: 120, praPurnaRate: 10.85, purnaRate: 12.0, excelRow: 58 },
  { minMonths: 121, maxMonths: 132, praPurnaRate: 10.85, purnaRate: 12.0, excelRow: 59 },
  {
    minMonths: 133,
    maxMonths: 144,
    praPurnaRate: 10.85,
    purnaRate: null, // Ambigu antara 12.00% (L59:O59) dan 12.10% (L60:O60)
    purnaOverlapRates: [12.0, 12.1],
    excelRow: "59-60"
  },
  { minMonths: 145, maxMonths: 168, praPurnaRate: 10.85, purnaRate: 12.1, excelRow: 60 },
  { minMonths: 169, maxMonths: 180, praPurnaRate: 10.85, purnaRate: 12.1, excelRow: 61 }
];

// Matriks Tarif Premi AJK CAR (dalam permil / per 1.000 UP)
// Sumber: 'AJK UP MENURUN BFP REG'!A2:U56
// Key: usia masuk saat aplikasi (DATEDIF(birthDate, processDate, "Y"), 20..74)
// Value: array panjang 20 untuk masa asuransi 1..20 tahun (ROUNDUP(tenorMonths / 12, 0))
// `null` = tidak dicover ("Tidak di Cover")
export const BNI_AJK_MENURUN_REG_RATES = {
  20: [0.77, 1.31, 1.8, 2.29, 2.78, 3.28, 3.81, 4.35, 4.93, 5.52, 6.13, 6.77, 7.42, 8.09, 8.77, 9.47, 10.19, 10.93, 11.64, 12.46],
  21: [0.78, 1.33, 1.84, 2.35, 2.86, 3.4, 3.96, 4.55, 5.16, 5.8, 6.46, 7.14, 7.84, 8.55, 9.28, 10.04, 10.81, 11.61, 12.39, 13.29],
  22: [0.81, 1.37, 1.9, 2.42, 2.98, 3.56, 4.17, 4.8, 5.46, 6.14, 6.85, 7.57, 8.33, 9.09, 9.88, 10.7, 11.54, 12.41, 13.26, 14.23],
  23: [0.83, 1.41, 1.97, 2.55, 3.14, 3.77, 4.42, 5.1, 5.8, 6.54, 7.3, 8.08, 8.88, 9.71, 10.56, 11.44, 12.36, 13.31, 14.24, 15.31],
  24: [0.86, 1.49, 2.09, 2.71, 3.36, 4.03, 4.73, 5.46, 6.23, 7.01, 7.82, 8.65, 9.52, 10.42, 11.34, 12.3, 13.3, 14.33, 15.36, 16.54],
  25: [0.91, 1.59, 2.25, 2.92, 3.62, 4.34, 5.1, 5.88, 6.69, 7.53, 8.4, 9.31, 10.25, 11.21, 12.22, 13.27, 14.36, 15.49, 16.63, 17.93],
  26: [0.99, 1.72, 2.43, 3.16, 3.9, 4.68, 5.49, 6.33, 7.2, 8.11, 9.04, 10.02, 11.03, 12.08, 13.19, 14.34, 15.53, 16.79, 18.04, 19.48],
  27: [1.08, 1.87, 2.63, 3.41, 4.21, 5.04, 5.91, 6.81, 7.74, 8.72, 9.73, 10.79, 11.89, 13.05, 14.25, 15.51, 16.83, 18.22, 19.6, 21.2],
  28: [1.15, 2.01, 2.82, 3.66, 4.51, 5.41, 6.34, 7.31, 8.32, 9.37, 10.47, 11.62, 12.83, 14.09, 15.42, 16.8, 18.26, 19.79, 21.33, 23.09],
  29: [1.24, 2.15, 3.03, 3.92, 4.84, 5.8, 6.8, 7.84, 8.93, 10.08, 11.27, 12.53, 13.85, 15.25, 16.71, 18.24, 19.85, 21.55, 23.26, 25.2],
  30: [1.32, 2.31, 3.25, 4.21, 5.19, 6.23, 7.3, 8.43, 9.62, 10.86, 12.17, 13.55, 15.01, 16.54, 18.15, 19.85, 21.64, 23.52, 25.41, 27.55],
  31: [1.43, 2.48, 3.49, 4.51, 5.58, 6.68, 7.85, 9.07, 10.36, 11.73, 13.17, 14.69, 16.3, 17.99, 19.77, 21.66, 23.64, 25.73, 27.81, 30.16],
  32: [1.52, 2.66, 3.74, 4.84, 5.98, 7.18, 8.45, 9.79, 11.2, 12.7, 14.29, 15.97, 17.75, 19.62, 21.6, 23.69, 25.88, 28.17, 30.47, 33.05],
  33: [1.64, 2.84, 4.01, 5.19, 6.44, 7.74, 9.13, 10.59, 12.15, 13.81, 15.56, 17.41, 19.38, 21.47, 23.66, 25.97, 28.38, 30.91, 33.43, 36.26],
  34: [1.74, 3.05, 4.31, 5.6, 6.95, 8.38, 9.89, 11.51, 13.24, 15.06, 17, 19.06, 21.25, 23.55, 25.98, 28.53, 31.18, 33.95, 36.72, 39.82],
  35: [1.89, 3.3, 4.67, 6.06, 7.54, 9.12, 10.79, 12.58, 14.48, 16.5, 18.65, 20.94, 23.36, 25.91, 28.58, 31.39, 34.32, 37.35, 40.38, 43.76],
  36: [2.04, 3.58, 5.06, 6.6, 8.23, 9.96, 11.81, 13.78, 15.89, 18.13, 20.52, 23.06, 25.74, 28.56, 31.5, 34.57, 37.79, 41.11, 44.42, 48.1],
  37: [2.22, 3.89, 5.52, 7.22, 9.02, 10.93, 12.98, 15.17, 17.5, 19.99, 22.65, 25.45, 28.4, 31.51, 34.75, 38.12, 41.63, 45.26, 48.86, 52.84],
  38: [2.41, 4.25, 6.05, 7.93, 9.91, 12.03, 14.31, 16.74, 19.33, 22.11, 25.04, 28.13, 31.38, 34.79, 38.34, 42.04, 45.87, 49.82, 53.71, 57.99],
  39: [2.65, 4.69, 6.67, 8.75, 10.96, 13.31, 15.83, 18.53, 21.42, 24.48, 27.71, 31.13, 34.7, 38.44, 42.31, 46.36, 50.52, 54.8, 58.99, 63.56],
  40: [2.93, 5.17, 7.38, 9.68, 12.12, 14.74, 17.55, 20.55, 23.74, 27.12, 30.69, 34.43, 38.35, 42.43, 46.68, 51.07, 55.59, 60.18, 64.64, 69.48],
  41: [3.23, 5.73, 8.17, 10.73, 13.44, 16.35, 19.47, 22.79, 26.32, 30.04, 33.95, 38.05, 42.34, 46.81, 51.43, 56.18, 61.03, 65.93, 70.64, 75.74],
  42: [3.6, 6.35, 9.06, 11.9, 14.94, 18.17, 21.63, 25.29, 29.17, 33.25, 37.55, 42.04, 46.72, 51.57, 56.57, 61.68, 66.85, 72.04, 76.96, 82.32],
  43: [3.98, 7.04, 10.07, 13.23, 16.59, 20.18, 23.98, 28.02, 32.27, 36.75, 41.45, 46.36, 51.45, 56.7, 62.08, 67.52, 73, 78.44, 83.57, 89.17],
  44: [4.42, 7.83, 11.2, 14.73, 18.45, 22.39, 26.59, 31.01, 35.67, 40.58, 45.71, 51.05, 56.56, 62.21, 67.93, 73.68, 79.43, 85.13, 90.45, 96.29],
  45: [4.93, 8.74, 12.48, 16.37, 20.47, 24.82, 29.42, 34.26, 39.37, 44.72, 50.3, 56.07, 62, 68.01, 74.07, 80.11, 86.11, 92.05, 97.56, 103.64],
  46: [5.51, 9.73, 13.88, 18.16, 22.67, 27.44, 32.46, 37.78, 43.35, 49.17, 55.2, 61.41, 67.71, 74.07, 80.42, 86.75, 92.99, 99.16, 104.86, 111.2],
  47: [6.11, 10.78, 15.33, 20.05, 24.99, 30.21, 35.72, 41.51, 47.57, 53.87, 60.34, 66.95, 73.61, 80.29, 86.93, 93.5, 100, 106.4, 112.3, 118.93],
  48: [6.75, 11.89, 16.9, 22.07, 27.49, 33.19, 39.2, 45.5, 52.06, 58.82, 65.71, 72.68, 79.67, 86.63, 93.55, 100.38, 107.12, 113.78, 119.9, 126.83],
  49: [7.43, 13.09, 18.57, 24.23, 30.16, 36.39, 42.93, 49.74, 56.77, 63.96, 71.23, 78.54, 85.84, 93.08, 100.26, 107.36, 114.36, 121.29, 127.66, 134.92],
  50: [8.17, 14.38, 20.4, 26.58, 33.05, 39.82, 46.89, 54.19, 61.66, 69.24, 76.87, 84.49, 92.08, 99.61, 107.06, 114.43, 121.73, 128.96, 135.59, 143.22],
  51: [8.96, 15.75, 22.34, 29.09, 36.12, 43.45, 51.02, 58.77, 66.64, 74.57, 82.52, 90.45, 98.33, 106.13, 113.88, 121.55, 129.18, 136.74, 143.65, 151.67],
  52: [9.83, 17.26, 24.45, 31.79, 39.39, 47.23, 55.25, 63.41, 71.64, 79.9, 88.17, 96.39, 104.56, 112.68, 120.74, 128.76, 136.73, 144.65, 151.87, 160.3],
  53: [10.76, 18.88, 26.69, 34.61, 42.73, 51.04, 59.47, 67.99, 76.56, 85.14, 93.7, 102.23, 110.73, 119.18, 127.6, 136, 144.35, 152.65, 160.21, 169.08],
  54: [11.76, 20.59, 29, 37.46, 46.05, 54.76, 63.56, 72.42, 81.31, 90.2, 99.08, 107.95, 116.8, 125.63, 134.45, 143.24, 152.01, 160.72, 168.64, 177.99],
  55: [12.79, 22.3, 31.28, 40.2, 49.19, 58.27, 67.42, 76.6, 85.81, 95.03, 104.26, 113.5, 122.75, 132.01, 141.26, 150.49, 159.69, 168.84, 177.17, 187.02],
  56: [13.78, 23.91, 33.38, 42.72, 52.07, 61.48, 70.95, 80.47, 90.01, 99.6, 109.23, 118.89, 128.59, 138.3, 148.02, 157.72, 167.4, 177.04, 185.81, null],
  57: [14.69, 25.35, 35.23, 44.94, 54.64, 64.39, 74.19, 84.06, 93.99, 103.99, 114.07, 124.21, 134.4, 144.61, 154.82, 165.04, 175.23, 185.4, null, null],
  58: [15.48, 26.61, 36.87, 46.93, 56.96, 67.05, 77.23, 87.49, 97.87, 108.35, 118.93, 129.59, 140.3, 151.06, 161.82, 172.59, 183.35, null, null, null],
  59: [16.15, 27.71, 38.35, 48.75, 59.15, 69.62, 80.21, 90.94, 101.82, 112.84, 123.97, 135.2, 146.48, 157.82, 169.18, 180.55, null, null, null, null],
  60: [16.79, 28.77, 39.76, 50.54, 61.34, 72.25, 83.33, 94.6, 106.05, 117.66, 129.39, 141.22, 153.13, 165.1, 177.1, null, null, null, null, null],
  61: [17.4, 29.8, 41.2, 52.4, 63.66, 75.1, 86.75, 98.61, 110.68, 122.92, 135.3, 147.79, 160.38, 173.03, null, null, null, null, null, null],
  62: [18.02, 30.87, 42.73, 54.43, 66.25, 78.29, 90.57, 103.09, 115.84, 128.76, 141.84, 155.04, 168.35, null, null, null, null, null, null, null],
  63: [18.69, 32.07, 44.47, 56.77, 69.23, 81.94, 94.92, 108.16, 121.62, 135.28, 149.12, 163.1, null, null, null, null, null, null, null, null],
  64: [19.47, 33.49, 46.54, 59.52, 72.69, 86.13, 99.86, 113.86, 128.1, 142.57, 157.21, null, null, null, null, null, null, null, null, null],
  65: [20.4, 35.16, 48.96, 62.7, 76.65, 90.87, 105.41, 120.23, 135.31, 150.64, null, null, null, null, null, null, null, null, null, null],
  66: [21.5, 37.12, 51.75, 66.32, 81.08, 96.16, 111.54, 127.25, 143.24, null, null, null, null, null, null, null, null, null, null, null],
  67: [22.77, 39.34, 54.85, 70.28, 85.94, 101.92, 118.25, 134.91, null, null, null, null, null, null, null, null, null, null, null, null],
  68: [24.17, 41.76, 58.21, 74.59, 91.2, 108.16, 125.5, null, null, null, null, null, null, null, null, null, null, null, null, null],
  69: [25.68, 44.35, 61.82, 79.2, 96.85, 114.88, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  70: [27.27, 47.12, 65.69, 84.18, 102.97, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  71: [29.02, 50.14, 69.91, 89.62, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  72: [30.92, 53.44, 74.53, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  73: [33.02, 57.08, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  74: [35.33, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null]
};

export const BNI_UNDERWRITING_DESCRIPTIONS = {
  HD: "HEALTH DECLARATION",
  NM: "Form Permintaan Penutupan Asuransi (SPAJ)",
  A: "SPAJ + SPD + Laporan Pemeriksaan Kesehatan (LPK)",
  B: "SPAJ + SPD + LPK + Cek Darah Rutin + Urin + EKG",
  C: "SPAJ + SPD + LPK + Cek Darah Lengkap + Urin + EKG + CXR",
  D: "SPAJ + SPD + LPK + Cek Darah Lengkap + Urin + EKG + CXR + ECHO",
  E: "SPAJ + SPD + LPK + Cek Darah Lengkap + Urin + EKG + CXR + ECHO + TUMOR"
};

// Catatan Audit Excel vs Kebijakan Menunggu Konfirmasi Klien
export const BNI_AUDIT_AND_OPEN_POLICIES = [
  {
    id: "BNI-GAP-01",
    topic: "Lookup Kode Produk 2 (BNI Fleksi Grace Period)",
    excelSource: "Kalkulator!D14, D15, J13:K16 vs J21:K21 vs PROD!B3:E5",
    finding:
      "Validasi dropdown D14 hanya menunjuk J13:J14 (Kode 1 dan 4). Kode 2 tersimpan di luar rentang (J21:K21), menyebabkan VLOOKUP D15 menghasilkan #N/A saat D14=2. Di sisi lain sheet PROD!B3:E5 hanya mendaftarkan Kode 1, 2, 3 tanpa Kode 4.",
    status: "UNCONFIRMED"
  },
  {
    id: "BNI-GAP-02",
    topic: "Formula Biaya Produk 2 dan 3",
    excelSource: "Kalkulator!B29 vs D29 vs Simulasi Asuransi!D23",
    finding:
      "Label Kalkulator!B29 mengelompokkan non-Kode 1 memakai 'Admin 150rb, Provisi 1% & BTL 3.5%', namun rumus nilai Kalkulator!D29 hanya bercabang untuk D14=1 dan D14=4 sehingga menghasilkan FALSE untuk D14=2 atau 3. Sementara Simulasi Asuransi!D23 memakai rumus berbeda: MAX(250rb, 1% * Plafond) + 150rb tanpa BTL 3.5%.",
    status: "UNCONFIRMED"
  },
  {
    id: "BNI-GAP-03",
    topic: "Tumpang Tindih Rentang Suku Bunga Tenor 133–144 Bulan",
    excelSource: "Kalkulator!L59:O60 (dan L14:O15)",
    finding:
      "Baris L59:M59 mencantumkan tenor 121–144 bln (Pra Purna 10,85%, Purna 12,00%), sedangkan baris L60:M60 mencantumkan 133–168 bln (Pra Purna 10,85%, Purna 12,10%). Rentang 133–144 bln tumpang tindih. Untuk Kode 4 (Pra Purna) tarif tetap 10,85%, tetapi untuk Kode 1 (Purna) terjadi perbedaan antara 12,00% dan 12,10%.",
    status: "UNCONFIRMED_FOR_PURNA_133_144"
  },
  {
    id: "BNI-GAP-04",
    topic: "Tarif Suku Bunga & Asuransi Bulan 181–240",
    excelSource: "Kalkulator!L52:O61, D18, D28 vs AJK UP MENURUN BFP REG!Q2:U56",
    finding:
      "Tabel suku bunga Kalkulator!L52:O61 berhenti eksplisit pada 169–180 bulan (M61=180). Meskipun D18/D28 mengizinkan tenor s.d. 240 bln untuk Pra Purna dan tabel AJK CAR memiliki kolom 16–20 tahun (kolom Q–U), belum ada baris suku bunga eksplisit untuk 181–240 bulan selain efek VLOOKUP aproksimasi Excel yang menempel ke baris 169–180.",
    status: "UNCONFIRMED"
  },
  {
    id: "BNI-GAP-05",
    topic: "Batas Tenor & Rumus Skema Grace Period Kombinasi (Kode 3)",
    excelSource: "Kalkulator!N33, D28, BN41:BN43; AJK UP MENURUN BFP GP KOMB!B1, B62; Simulasi Asuransi!H12; Sheet1!E7",
    finding:
      "Batas tenor Kombinasi berkonflik antar sheet (1–6 thn di N33 vs 180 bln di D28 vs 240 bln di Simulasi Asuransi!H12 & Sheet1!E7). Header AJK UP MENURUN BFP GP KOMB!B1 dan AJK UP TURUN IBR!B1 dimulai dari 2 tahun sehingga VLOOKUP B62 bergeser +1 tahun, serta Kalkulator!BN42:BN43 salah merujuk sel B66/B67.",
    status: "UNCONFIRMED"
  },
  {
    id: "BNI-GAP-06",
    topic: "Acuan kategori underwriting",
    excelSource: "AJK UP MENURUN BFP REG!B68, AA1:CC1",
    finding: "Rumus B68 membaca kategori pada kolom usia tiga tahun lebih tinggi. Hasil mengikuti header usia dan memerlukan verifikasi sebelum pengajuan jika kedua acuan berbeda.",
    status: "UNCONFIRMED"
  }
];

export function normalizeBniProductCode(raw) {
  if (raw != null && typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw ?? "4").trim().toUpperCase();
  if (s === "1" || s === "REGULER" || s === "PURNA" || s === "BNI FLEKSI REGULER") return "1";
  if (s === "2" || s === "GP" || s === "GRACE_PERIOD" || s === "BNI FLEKSI GRACE PERIOD") return "2";
  if (s === "3" || s === "KOMBINASI" || s === "GP_KOMBINASI" || s === "BNI FLEKSI GRACE PERIOD KOMBINASI") return "3";
  if (s === "4" || s === "PRA_PURNA" || s === "PRAPURNA" || s === "BNI FLEKSI PRA PURNA") return "4";
  return null;
}

export function normalizeBniInsuranceScheme(raw) {
  if (raw != null && typeof raw !== "string") return null;
  const s = String(raw ?? "MENURUN").trim().toUpperCase();
  if (!s) return "MENURUN";
  return Object.values(BNI_INSURANCE_SCHEMES).find(
    (scheme) => s === scheme.code || s === scheme.label.toUpperCase()
  )?.code ?? null;
}

export function resolveBniUnderwritingCode(ageYears, plafond) {
  const p = Number(plafond || 0);
  const age = Math.floor(Number(ageYears || 0));
  if (!Number.isFinite(p) || p <= 0 || !Number.isInteger(age) || age < 20 || age > 74 || p > BNI_UNDERWRITING_MAX_PLAFOND) {
    return null;
  }
  if (p <= 500000000) return "HD";
  if (p <= 1000000000) return "NM";
  if (p <= 3000000000) {
    if (age <= 45) return "NM";
    if (age <= 50) return "A";
    if (age <= 55) return "B";
    if (age <= 60) return "C";
    return "D";
  }
  if (p <= 5000000000) {
    if (age <= 40) return "A";
    if (age <= 50) return "B";
    if (age <= 60) return "C";
    return "D";
  }
  return "D";
}

export function requiresBniUnderwritingReview(age, plafond, tableCode = resolveBniUnderwritingCode(age, plafond)) {
  // B68 selects three columns to the right of the age header. The last
  // three ages select empty cells, represented by null here.
  return Boolean(tableCode && tableCode !== resolveBniUnderwritingCode(Number(age) + 3, plafond));
}

export function getBniFleksiConfig(partner) {
  if (partner?.engine === "bni_fleksi") return partner;
  return partner?.fleksi?.engine === "bni_fleksi" ? partner.fleksi : null;
}

export function canActivateLegacyBniFleksi(partner) {
  return partner?.id === "bank_bni" &&
    partner.engine === "partner_bank" && partner.active === false &&
    Number.isFinite(partner.maxInstallmentRatio) &&
    partner.maxInstallmentRatio >= 10 && partner.maxInstallmentRatio <= 100 &&
    Number.isSafeInteger(partner.maxPlafondAbsolute) && partner.maxPlafondAbsolute > 0 &&
    Number.isSafeInteger(partner.maxTenorMonths) && partner.maxTenorMonths > 0 &&
    !Object.hasOwn(partner, "fleksi");
}

export function createDefaultBniConfig() {
  return {
    id: "bank_bni",
    code: "BNI-FLEKSI",
    name: "Bank BNI — BNI Fleksi Pensiun & Pra Purna",
    shortName: "Bank BNI · Fleksi",
    type: "bank_konvensional",
    engine: "bni_fleksi",
    schemaVersion: BNI_SCHEMA_VERSION,
    policyVersion: BNI_POLICY_VERSION,
    revision: 1,
    active: true,
    badgeColor: "green",
    description:
      "Kalkulator BNI Fleksi Kredit Pensiun (MKSA v4 Jul26) untuk BNI Fleksi Reguler (Kode 1) & BNI Fleksi Pra Purna (Kode 4) dengan AJK CAR UP Menurun dan subsidi premi 150 permil.",
    interestRateAnnual: 10.5,
    interestMethod: "annuity",
    maxInstallmentRatio: 90.0,
    dbrPresets: [...BNI_DBR_PRESETS],
    maxPlafondAbsolute: BNI_UNDERWRITING_MAX_PLAFOND,
    maxTenorMonths: BNI_CONFIRMED_MAX_TENOR_MONTHS,
    maxEndAgeYears: BNI_MAX_AGE_LIMIT_YEARS,
    maxEndAgeMonths: 0,
    minEntryAgeYears: 20,
    maxEntryAgeYears: 74,
    subsidyPermilCap: BNI_SUBSIDY_PERMIL,
    adminFee: 150000,
    provisionRatePercent: 1.0,
    insuranceRatePercent: 0.0,
    tataLaksanaRatePercent: 3.5,
    retentionMultiplier: 3,
    products: structuredClone(BNI_PRODUCT_DEFINITIONS),
    insuranceSchemes: structuredClone(BNI_INSURANCE_SCHEMES),
    interestRateTiers: structuredClone(BNI_INTEREST_RATE_TIERS),
    ajkMenurunRegRates: structuredClone(BNI_AJK_MENURUN_REG_RATES),
    underwritingDescriptions: { ...BNI_UNDERWRITING_DESCRIPTIONS },
    auditAndOpenPolicies: structuredClone(BNI_AUDIT_AND_OPEN_POLICIES)
  };
}

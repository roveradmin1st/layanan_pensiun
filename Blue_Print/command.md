# Instruksi Teknis Antigravity: Perbaikan Parameter BSI Prapen dan Pensiun

Tanggal: 6 November 2026  
Repository: https://github.com/roveradmin1st/layanan_pensiun  
Branch acuan: `fix/security-and-operational-integrity`  
Commit yang diaudit: `6df4925e3731230243e9a91ec4f2e69a47499d0e`

Dokumen ini adalah arahan implementasi berdasarkan audit berkas Excel, screenshot superadmin, dan pemeriksaan kode. Perubahan aplikasi yang dijelaskan belum diterapkan oleh audit ini. Pengaturan dan database produksi belum diperiksa langsung.

## 1. Tujuan dan batas pekerjaan

Perbaiki pengelolaan parameter BSI agar TriBerkah, Dekade, dan Pensiun memiliki konfigurasi yang terpisah. Samakan konfigurasi yang ditampilkan superadmin, rekomendasi pada layar kalkulator, perhitungan backend, dan keluaran dokumen.

Ketentuan yang dikonfirmasi klien untuk **TriBerkah / PP3**:

- Tenor pembiayaan maksimum **240 bulan / 20 tahun**.
- Angsuran terakhir paling lambat pada usia **74 tahun 6 bulan**.
- Terapkan kedua batas sekaligus, mengikuti batas yang tercapai lebih dahulu.
- Batas 36 bulan adalah jendela menuju pensiun ketika mengajukan prapen, bukan maksimum tenor pembiayaan.

Untuk **PP10 / Dekade**, pertahankan kebijakan dan nilai berjalan kecuali ada koreksi yang secara eksplisit termasuk dalam dokumen ini. Ketentuan 240 bulan dari klien berlaku khusus PP3.

Untuk **produk PENSIUN**, pertahankan algoritme finansial yang mengacu pada sheet biru `Akseptasi Pensiun`, `Pensiun`, dan `Rincain keNsb` dari `Kalkukator Pensiun rev1.xlsx`. Pemindahan konstanta ke konfigurasi tidak boleh mengubah hasil regresi pada konfigurasi awal.

Sumber asuransi harus tetap berbeda:

- PP3 dan PP10: `Simas Prapensiun.xlsm`.
- PENSIUN: `Simulasi Premi AJP (Pensiun) BSI + Atribusi (Standarisasi RTC) - 20260629 - Final.xlsm`, profil `simas-pensiun-menurun-2026-06-29`.
- PDF `Tabel_Simas_Jiwa_Usia_54-70_AUDIT.pdf` cocok dengan subset tabel prapen; bukan pengganti tabel pensiun atau seluruh tabel prapen.

## 2. Temuan yang menjadi dasar patch

| ID | Temuan terkonfirmasi | Dampak |
|---|---|---|
| F01 | PP3 dan PP10 sama-sama membaca `bsi_prapen.maxTenorMonths`. | Mengubah 180 menjadi 240 pada panel ikut mengubah kedua produk. |
| F02 | Default BSI masih 180 bulan, `maxEndAgeYears: 74`, `maxEndAgeMonths: 4`. | Ketentuan TriBerkah 240 bulan dan 74 tahun 6 bulan belum terwakili. |
| F03 | Form BSI hanya menampilkan tahun usia akhir. | Tambahan 4 bulan dipakai backend tetapi tidak terlihat/dapat diubah melalui form tersebut. |
| F04 | Jalur hitung PENSIUN sudah terpisah, tetapi parameter pada panel bersama tidak mengendalikan batas finansial PENSIUN. | Label panel memberi kesan cakupan yang berbeda dari perilaku engine. Solusinya adalah konfigurasi PENSIUN sendiri, bukan membuat PENSIUN membaca konfigurasi prapen. |
| F05 | `computeBsiLiveRecommendation` memakai `pensionSalary * 0.9`. | Saat DSR dikonfigurasi 70%, backend memakai kapasitas Rp7 juta tetapi rekomendasi layar tetap Rp9 juta untuk manfaat pensiun Rp10 juta. |
| F06 | Rekomendasi layar membatasi plafon dengan angka tetap Rp800 juta. | Pada skenario uji dengan batas produk Rp300 juta, backend membatasi Rp300 juta sedangkan fungsi rekomendasi layar masih menghasilkan Rp741 juta. |
| F07 | Tanggal selesai pada fungsi rekomendasi memakai `start + tenor`, sedangkan backend memakai `start + tenor - 1`. | Tanggal akhir berbeda satu bulan. |
| F08 | Validasi usia prapen membandingkan tenor dengan sisa waktu dari tanggal proses, bukan langsung dengan tanggal angsuran terakhir. | Pengajuan dapat berstatus `overall_ok=true` walaupun angsuran terakhir melewati batas usia. |
| F09 | UI memakai default buffer asuransi 0 bulan, tetapi backend masih dapat memakai 6 bulan ketika field tidak dikirim. | Tenor 240 dapat menjadi masa polis 246 bulan dan gagal pada batas polis 20 tahun. |

Pemeriksaan audit pada salinan commit ini mencakup 22 pemeriksaan terarah dan eksekusi 15 tes dalam `bsi-pensiun-preview.test.mjs`. Angka tersebut menunjukkan pemeriksaan kode yang dijalankan, bukan sertifikasi seluruh hasil terhadap Microsoft Excel atau pengujian sistem produksi.

## 3. Persiapan implementasi

1. Gunakan branch acuan di atas, periksa perubahan setelah commit audit, dan buat branch kerja khusus perbaikan ini.
2. Catat commit awal, versi engine, dan snapshot konfigurasi sebelum perubahan.
3. Baca aturan repository yang berlaku pada checkout tim.
4. Jalankan tes baseline yang tersedia sebelum perubahan dan simpan hasilnya.
5. Pertahankan `bank_key: "bsi_prapen"` agar pemisahan produk tidak merusak RBAC, akses cabang, serta histori yang memakai bank key lama.
6. Lakukan pemisahan konfigurasi, migrasi, dan perbaikan kalkulasi secara terarah. Perubahan kebijakan payroll, pembagian fase, atau pricing yang belum ditetapkan tidak boleh disisipkan diam-diam dalam refactor ini.

## 4. Struktur konfigurasi produk

Gunakan namespace terpisah:

```text
partner_parameters.bsi_prapen.products.PP3
partner_parameters.bsi_prapen.products.PP10
partner_parameters.bsi_prapen.products.PENSIUN
```

Metadata mitra seperti nama, logo, dan status aktif dapat tetap berada pada tingkat bank. Batas tenor, usia, plafon, rasio angsuran, pricing, atribusi, biaya, dan pemilihan profil asuransi harus mempunyai cakupan produk.

Contoh bagian konfigurasi PP3; nama field boleh disesuaikan asalkan kontraknya konsisten:

```js
products: {
  PP3: {
    policyVersion: "bsi-pp3-240m-74y6m-v1",
    loan: {
      maxTenorMonths: 240,
      maxMaturityAgeMonths: 894,
      maxPlafondAbsolute: 800000000,
      maximumPrincipalRoundingStep: 1000000
    },
    activePhase: {
      maxMonthsToRetirement: 36
      // Rasio payroll dan bobot pendapatan disalin dari konfigurasi berjalan.
    },
    retiredPhase: {
      maxInstallmentRatioPercent: 90
    },
    insurance: {
      profileId: "simas-prapen-menurun",
      bufferDefaultMonths: 0
    }
    // Pricing, atribusi, dan biaya tetap harus dimasukkan dengan nilai berjalan.
  }
}
```

Satuan internal batas usia adalah **jumlah bulan penuh**. Untuk PP3, `894 = 74 * 12 + 6`. Antarmuka menampilkan nilainya sebagai tahun dan tambahan bulan.

Buat resolver murni, misalnya:

```js
resolveBsiProductConfig(allParams, productCode)
```

Kontrak resolver:

- Menerima kode kanonis `PP3`, `PP10`, atau `PENSIUN`.
- Menolak produk tidak dikenal dan konfigurasi produk yang tidak tersedia.
- Mengembalikan konfigurasi produk beserta versi aturan dan profil asuransinya.
- Tidak mengambil parameter produk lain sebagai fallback.
- Pemetaan alias atau input legacy dilakukan satu kali pada boundary API, dengan aturan kompatibilitas yang terdokumentasi.

## 5. Migrasi konfigurasi tersimpan

Ubah `backend/src/db/database.js`, termasuk mekanisme `ensureStoreUpgrades` atau migrasi penggantinya. Mengubah `default-parameters.js` saja tidak memperbarui konfigurasi yang sudah tersimpan.

Persyaratan migrasi:

1. Tambahkan `schemaVersion` pada struktur parameter dan `policyVersion` per produk.
2. Simpan snapshot konfigurasi sebelum migrasi.
3. Salin nilai prapen berjalan ke PP3 dan PP10, termasuk nilai khusus instalasi yang masih berlaku.
4. Terapkan koreksi terarah PP3: maksimum tenor 240 dan usia akhir 894 bulan.
5. Bentuk konfigurasi PENSIUN dari konstanta/profil yang dipakai jalur hitung PENSIUN saat ini. Jangan menyalin batas prapen Rp800 juta, usia masuk 65 tahun, atau masa polis 20 tahun ke PENSIUN.
6. Kerjakan dalam transaksi dan beri penanda migrasi selesai.
7. Migrasi harus idempoten: eksekusi ulang tidak menggandakan data atau menimpa konfigurasi yang sudah diedit setelah migrasi pertama.
8. Pertahankan hasil simulasi historis dan nilai hasil perhitungannya.
9. Perbarui mekanisme reset agar menggunakan skema baru dan cakupan produk yang benar.
10. Parameter keuangan legacy pada root tidak boleh tetap menjadi sumber aktif yang bersaing dengan konfigurasi produk baru.

## 6. API parameter dan Dual Control

Tambahkan cakupan produk pada API, misalnya:

```text
GET /api/calc/params/bsi_prapen/products/PP3
PUT /api/calc/params/bsi_prapen/products/PP3
```

Terapkan pola yang sama bagi PP10 dan PENSIUN. Struktur endpoint boleh berbeda jika sesuai arsitektur tim, tetapi bank dan produk harus selalu dapat dibedakan.

Ketentuan perubahan:

- Gunakan validasi skema dan daftar field yang diizinkan.
- Validasi angka hingga rentang, satuan, dan hubungan antarparameter; bukan hanya memastikan payload berbentuk objek.
- Jangan menerapkan seluruh payload mentah melalui `Object.assign`.
- Simpan `partner_key`, `product_key`, alasan, versi, dan nilai sebelum/sesudah pada audit perubahan.
- Proposal Admin Operasional serta keputusan Superadmin harus menunjuk produk yang sama.
- Persetujuan perubahan PP3 hanya memperbarui PP3.
- Gunakan versi konfigurasi yang diharapkan pada request perubahan; tolak konflik edit dari snapshot lama secara jelas.
- Reset per produk hanya memengaruhi produk tersebut. Reset semua produk, jika tetap disediakan, harus merupakan tindakan yang eksplisit.
- Perbarui `/api/calc/limits` untuk mengembalikan batas per produk.
- Pertahankan pemeriksaan autentikasi, role, dan akses bank/cabang yang sudah berlaku.
- Dokumentasikan kompatibilitas endpoint lama; hindari pembaruan keuangan gabungan yang kembali memengaruhi seluruh produk BSI.

## 7. Resolusi konfigurasi pada engine

Ubah `backend/src/engines/calc-engine.js` agar `calculateMax` dan `calculatePreview`:

1. Menormalisasikan identitas produk sekali.
2. Meresolusi konfigurasi produk yang sama.
3. Menggunakan snapshot konfigurasi dan input tanggal yang sama.
4. Mengembalikan identitas produk dan versi aturan yang dipakai.

PP3 dan PP10 harus membaca konfigurasi masing-masing. PENSIUN tetap melalui jalur hitung PENSIUN, menggunakan konfigurasi dan profil PENSIUN sendiri.

Gunakan pemeriksaan eksplisit atau `??` untuk nilai nol yang sah. Contohnya, buffer asuransi 0 dan tambahan bulan usia 0 tidak boleh berubah menjadi 6 atau 4 akibat operator `||`.

Pemindahan parameter PENSIUN ke konfigurasi harus mempertahankan:

- Rumus PMT/RATE dan urutan pembulatan.
- Perbedaan Reguler dan Atribusi Premi.
- Definisi DBR dan DSR.
- Faktor pasangan 98% pada kondisi yang berlaku.
- Profil tarif Simas Pensiun, batas pertanggungan, dan hasil baseline yang sudah diuji.

Jangan menyamakan rumus PENSIUN dengan formula fase pascapensiun nasabah prapen.

## 8. Validasi tanggal akhir prapen

Tetapkan satu sumber data untuk tanggal lahir, pencairan, angsuran pertama, dan tenor pembiayaan. Validasi tanggal kalender secara ketat.

Rumus wajib:

```js
const maturityDate = addMonthsClamped(
  firstInstallmentDate,
  tenorMonths - 1
);

const ageLimitDate = addMonthsClamped(
  birthDate,
  productConfig.loan.maxMaturityAgeMonths
);

const tenorValid =
  Number.isInteger(tenorMonths) &&
  tenorMonths > 0 &&
  tenorMonths <= productConfig.loan.maxTenorMonths;

const maturityAgeValid =
  tenorValid && maturityDate <= ageLimitDate;
```

Sebelum rumus dijalankan, tanggal harus sudah dinormalisasi ke tanggal kalender yang konsisten antarlapisan.

Maksimum tenor berdasarkan usia adalah bilangan bulat terbesar dalam batas produk yang memenuhi tanggal akhir di atas. Dengan maksimum 240, pencarian langsung pada 1–240 bulan cukup kecil dan menghindari kesalahan pendekatan umur.

Ketentuan kalender:

- Tanggal tepat pada batas usia diperbolehkan.
- Tanggal setelah batas usia ditolak.
- Gunakan perilaku setara `EDATE`, termasuk akhir bulan dan tahun kabisat.
- Hitung setiap tanggal dari tanggal angsuran pertama yang asli, agar penyesuaian Februari tidak menyebabkan pergeseran berantai.
- Hindari konversi batas usia melalui pembagian jumlah hari dengan 30, 30,5, atau 365,25.
- Samakan rumus tanggal akhir pada backend, rekomendasi layar, PDF, dan SVG.
- Pertahankan algoritme pembagian fase pada patch ini. Jika ditemukan kebutuhan mengubah cara menghitung bulan aktif, catat dan uji sebagai perubahan finansial tersendiri.

### Kasus regresi wajib: tanggal akhir melewati batas usia

```text
Produk:                    PP3
Tanggal lahir:             1967-12-26
Tanggal proses/pencairan:  2027-06-01
Angsuran pertama:          2027-08-01
Tenor:                     180 bulan
Batas usia produk:         894 bulan / 74 tahun 6 bulan
Batas tanggal usia:        2042-06-26
Angsuran terakhir:         2042-07-01
```

Pada uji salinan kode lama, dengan maksimum tenor disetel 240 dan usia akhir 74 tahun 6 bulan, kasus ini masih menghasilkan `end_age=true` dan `overall_ok=true`.

Hasil yang diwajibkan setelah perbaikan:

```text
end_age = false
overall_ok = false
```

## 9. Konsistensi rekomendasi layar, maksimum, dan preview

Pada `frontend/src/pages/Calculator.jsx`, fungsi `computeBsiLiveRecommendation` masih mempunyai angka tetap. Hilangkan sumber perhitungan yang bersaing dengan konfigurasi aktif.

Pilih implementasi yang konsisten:

- Frontend menampilkan rekomendasi keuangan dari backend; atau
- Frontend dan backend menggunakan modul kalkulasi murni yang sama, dengan input serta snapshot konfigurasi yang identik.

Persyaratan:

1. DSR pascapensiun prapen membaca konfigurasi produk, menggantikan angka tetap `0.9`.
2. Batas plafon membaca konfigurasi produk, menggantikan angka tetap `800000000`.
3. Tanggal akhir memakai `tenor - 1` pada seluruh lapisan.
4. Hasil dari request lama tidak boleh menimpa input atau pilihan produk yang lebih baru.
5. Perubahan produk atau versi aturan menginvalidasi rekomendasi sebelumnya.
6. Jika ada cache, kuncinya harus mencakup produk, versi aturan, dan seluruh input yang relevan.
7. Frontend menampilkan alasan pembatas atau penolakan yang berasal dari hasil evaluator.

### Maksimum harus dapat dipenuhi

Ekstrak evaluator skenario murni, misalnya:

```js
evaluateBsiScenario(input, productConfig, candidatePrincipal)
```

Evaluator menghitung premi, atribusi, jadwal/angsuran, batas pertanggungan, tanggal akhir, dan status validasi tanpa memanggil pencarian maksimum.

Kemudian:

- `calculateMax` menggunakan evaluator tersebut untuk mencari kandidat terbesar yang memenuhi batas.
- `calculatePreview` menggunakan evaluator yang sama untuk nominal pengajuan.
- Hindari rekursi `calculateMax -> calculatePreview -> calculateMax`.
- Hitung premi ulang untuk setiap kandidat; jangan memakai premi yang tertinggal dari nominal sebelumnya.
- Pertahankan semantik override premi manual yang memang didukung dan tandai sumber preminya. Override tidak boleh menghapus pemeriksaan usia, masa polis, atau batas UP.
- Pertahankan pembulatan maksimum prapen Rp1 juta sesuai versi engine yang telah dikoreksi. Jangan membulatkan semua komponen uang menjadi Rp1 juta.
- Untuk batas produk Rp800 juta, pencarian kandidat pada kelipatan Rp1 juta masih terbatas. Optimasi boleh diterapkan setelah perilaku pada pergantian tier dan batas aturan diuji.
- Maksimum yang ditampilkan wajib lolos evaluator final pada input dan versi aturan yang sama.
- Bedakan maksimum, plafon pengajuan, nominal hasil simulasi, UP, dan cash on hand.

Rumus batas setelah atribusi tetap harus diperiksa pada nilai pertanggungan, bukan hanya plafon awal. Profil serta tabel prapen dan pensiun harus dipilih berdasarkan produk.

## 10. Durasi asuransi

Jadikan buffer masa asuransi parameter eksplisit per produk:

```text
insuranceMonths = loanTenorMonths + insuranceBufferMonths
```

Aturan sinkronisasi:

- Selaraskan default backend dengan alur UI yang berjalan, yaitu 0 bulan.
- Request yang secara eksplisit memilih 6 harus tetap dihitung sebagai 6.
- Jangan mengubah histori yang sebelumnya menggunakan buffer eksplisit.
- `calculateMax`, preview, rekomendasi, dan ekspor harus memakai durasi asuransi yang sama.
- Tenor 240 dengan buffer 6 menghasilkan masa polis 246 bulan; status harus menyatakan tidak memenuhi batas polis 20 tahun pada profil prapen tersebut.
- Jangan memotong 246 menjadi 240 secara diam-diam.
- Jangan menganggap tarif nol atau kombinasi tarif tidak tersedia sebagai premi gratis.
- Masa polis, usia underwriting, dan batas UP tetap diperiksa tersendiri setelah batas tenor bank terpenuhi.

## 11. Tampilan superadmin

Ubah `frontend/src/pages/Settings.jsx` menjadi pengaturan BSI dengan pilihan produk:

```text
BSI
├─ TriBerkah / PP3
├─ Dekade / PP10
└─ Pensiun Berkah
```

Setiap form menampilkan parameter yang benar-benar dipakai produk terpilih.

Wajib tersedia:

- Tenor maksimum dalam bulan.
- Usia akhir dalam tahun dan tambahan bulan.
- Batas plafon dengan label cakupannya yang jelas.
- Rasio angsuran sesuai fase atau produk.
- Versi aturan aktif.
- Identitas produk pada tindakan simpan, usulan, persetujuan, dan reset.

Label prapen yang direkomendasikan:

```text
DBR Masa Aktif — Prapen
DSR Fase Pasca Pensiun — Prapen
```

Parameter DSR fase pascapensiun tetap diperlukan untuk prapen. Parameter tersebut berbeda dari DBR/DSR produk PENSIUN.

Form PENSIUN harus menampilkan konfigurasi yang benar-benar dibaca jalur PENSIUN. Pertahankan arti pilihan Reguler/Atribusi, jenis pensiunan, pasangan, dan DBR/DSR yang sudah didukung.

## 12. Peta file perubahan

| File | Pekerjaan |
|---|---|
| `backend/src/config/default-parameters.js` | Struktur default parameter per produk. |
| Modul konfigurasi/resolver baru | Normalisasi kode produk, validasi skema, resolusi, dan versi aturan. |
| `backend/src/db/database.js` | Migrasi transaksional dan idempoten dari konfigurasi tersimpan. |
| `backend/src/server.js` | API parameter/limits, validasi, proposal, approval, reset, dan kontrak hasil kalkulasi. |
| `backend/src/engines/calc-engine.js` | Konfigurasi per produk, evaluasi skenario, maksimum, preview, dan validasi tanggal akhir prapen. |
| `backend/src/config/bsi-pensiun-simas-20260629.js` | Pertahankan profil sumber serta identitas versi tarif pensiun. |
| `backend/src/engines/bsi-pensiun-preview.js` | Pertahankan perannya sebagai pembanding/regresi; pastikan refactor tidak mengubah hasil acuan tanpa alasan yang terdokumentasi. |
| `frontend/src/pages/Settings.jsx` | Form dan cakupan perubahan per produk, tahun serta bulan usia. |
| `frontend/src/pages/Calculator.jsx` | Sumber rekomendasi, kontrak input tanggal, dan sinkronisasi hasil. |
| `frontend/src/lib/bsiPensiunSimas.js` | Selaraskan konfigurasi/sumber hasil dengan jalur PENSIUN aktif; pertahankan regresinya. |
| `frontend/src/components/calc/ResultView.jsx` dan ekspor terkait | Konsistensi identitas produk, tanggal, angka, dan alasan pembatas. |
| `backend/tests/*` dan `backend/package.json` | Tes baru dan pendaftaran tes dalam perintah eksekusi proyek. |

Jika jalur standalone di `assets/js/` masih disajikan kepada pengguna, periksa konsistensinya dan dokumentasikan tindakan yang diperlukan. Jangan menyatakan jalur tersebut sudah diperbaiki hanya berdasarkan perubahan frontend React.

## 13. Pengujian penerimaan

Tambahkan pengujian bermakna untuk batas kalender, isolasi produk, migrasi, perubahan parameter, serta kesamaan hasil antarlapisan.

| ID | Skenario | Hasil yang diwajibkan |
|---|---|---|
| T01 | PP3, tenor 240 dan seluruh batas lain terpenuhi | Lolos validasi tenor. |
| T02 | PP3, tenor 241 | Ditolak. |
| T03 | PP3, tenor pecahan atau tidak positif | Ditolak secara jelas. |
| T04 | Angsuran terakhir tepat pada batas usia PP3 | Lolos pemeriksaan tanggal akhir. |
| T05 | Angsuran terakhir setelah batas usia | `end_age=false`; hasil akhir tidak layak. |
| T06 | Kasus regresi lahir 1967-12-26 pada bagian 8 | Ditolak karena angsuran terakhir 2042-07-01 melewati 2042-06-26. |
| T07 | Akhir bulan dan tahun kabisat | Tanggal konsisten dengan perilaku EDATE yang ditetapkan. |
| T08 | Ubah parameter PP3 | Konfigurasi dan hasil PP10/PENSIUN tetap pada input tetap. |
| T09 | Ubah parameter PP10 | Konfigurasi dan hasil PP3/PENSIUN tetap pada input tetap. |
| T10 | Ubah parameter PENSIUN | Konfigurasi dan hasil PP3/PP10 tetap pada input tetap. |
| T11 | DSR pascapensiun prapen 70%, manfaat Rp10 juta | Layar dan backend memakai kapasitas Rp7 juta sebelum pengurang lain yang berlaku. |
| T12 | Batas plafon produk Rp300 juta | Seluruh rekomendasi maksimum tidak melampaui Rp300 juta. |
| T13 | Tenor 240 dan buffer 0 | Masa polis 240; kelayakan tarif/usia/UP tetap diperiksa. |
| T14 | Tenor 240 dan buffer 6 | Masa polis 246; profil dengan batas 240 menyatakan tidak memenuhi ketentuan. |
| T15 | Buffer 0 dan tambahan bulan usia 0 | Nilai nol dipertahankan, tidak berganti akibat fallback `||`. |
| T16 | Maksimum hasil rekomendasi | Lolos evaluator final pada input dan versi aturan yang sama. |
| T17 | Simpan, usulkan, setujui, dan reset PP3 | Hanya PP3 yang berubah, dengan audit sebelum/sesudah. |
| T18 | Migrasi dijalankan dua kali | Tidak menggandakan data dan tidak menimpa edit setelah migrasi pertama. |
| T19 | Konfigurasi khusus instalasi | Nilai yang tidak termasuk koreksi terarah tetap dipertahankan. |
| T20 | Histori simulasi | Nominal dan hasil historis tidak berubah. |
| T21 | Edit dari versi konfigurasi lama | Konflik ditangani jelas; perubahan baru tidak tertimpa. |
| T22 | Respons rekomendasi datang tidak berurutan | Hasil input/produk lama tidak menimpa hasil terbaru. |

### Fixture reproduksi selisih parameter layar dan backend

Gunakan data sintetis berikut untuk menguji rekomendasi prapen:

```json
{
  "bank_key": "bsi_prapen",
  "bsi_sub_product": "PP3",
  "birth_date": "1972-12-01",
  "process_date": "2026-11-01",
  "bsi_proyeksi_cair": "2026-11-01",
  "bsi_start_angsuran": "2026-12-01",
  "bup_age": 55,
  "bsi_status_gaji": "Payroll",
  "bsi_dbr_chosen": 70,
  "gaji_pokok": 20000000,
  "pension_salary": 10000000,
  "plafond": 100000000,
  "tenor": 180,
  "bsi_price_aktif": 9.25,
  "bsi_price_pensiun": 10.5,
  "bsi_insurance_buffer_months": 0,
  "bsi_skema": "Atribusi",
  "bsi_akad": "Murabahah",
  "angsuran_bsi": 0,
  "angsuran_selain_bsi": 0
}
```

Pada snapshot audit:

- Mengubah batas DSR fase pensiun menjadi 70 menghasilkan kapasitas backend Rp7 juta, sedangkan fungsi rekomendasi frontend masih Rp9 juta.
- Mengubah batas plafon menjadi Rp300 juta menghasilkan maksimum backend Rp300 juta, sedangkan fungsi rekomendasi frontend masih Rp741 juta.

Angka Rp741 juta adalah reproduksi perilaku lama pada fixture tersebut, bukan target hasil setelah perbaikan. Setelah patch, rekomendasi wajib mengikuti parameter dan evaluator final.

### Regresi Pensiun biru

Pertahankan fixture yang sudah tersedia di repo, termasuk kondisi berikut:

| Komponen | Nilai acuan fixture |
|---|---:|
| Tanggal lahir | 1966-06-10 |
| Tanggal proses/mulai asuransi | 2026-10-01 |
| Angsuran pertama | 2026-11-01 |
| Manfaat pensiun | Rp2.301.400 |
| Plafon | Rp166.000.000 |
| Tenor | 169 bulan |
| Pricing dasar | 10,5% |
| Basis rasio | DBR 90%, tanpa angsuran berjalan |
| Pasangan | Single |
| Flagging | TASPEN_CTP |
| Skema | Atribusi Premi |
| Tarif asuransi | 143,01 per mil |
| Premi | Sekitar Rp27.701.210,05 |
| Price akhir | 12,09% |
| Angsuran | Sekitar Rp2.048.954,50 |
| Maksimum indikatif | Rp167.000.000 |

Jalankan pula regresi Reguler, profil tarif, pasangan, DBR/DSR, dan baseline prapen yang tersedia. Fixture PP10 480 juta/180 bulan pada suite berjalan harus tetap mempertahankan hasil finansialnya pada konfigurasi yang sama.

## 14. Eksekusi dan bukti pengujian

Perintah yang pernah digunakan pada audit untuk menjalankan 15 tes yang mencakup baseline prapen dan pensiun:

```bash
cd backend
node tests/bsi-pensiun-preview.test.mjs
```

Untuk patch, jalankan seluruh suite proyek, tambahkan tes baru, dan daftarkan pada `npm test`. Periksa bahwa assertion baseline benar-benar dipanggil; keberhasilan memuat sebuah file tidak cukup sebagai bukti pengujian.

```bash
cd backend
npm test
```

Jalankan pemeriksaan frontend yang tersedia pada checkout tim. Simpan perintah yang benar-benar dijalankan, jumlah tes, hasil, serta kegagalan yang belum terselesaikan.

Lakukan uji antarmuka terhadap perubahan parameter produk dan pembacaan ulang hasil kalkulator. Bedakan bukti uji fungsi, HTTP/API, browser, serta pembandingan Excel.

Laporan sejuta kasus yang ada di repo membahas versi engine lebih awal dan mencatat keterbatasan pembandingan native. Laporan tersebut tidak menjadi bukti kelulusan patch ini atau sertifikasi otomatis terhadap Microsoft Excel.

## 15. Keluaran yang harus diserahkan tim AI

Serahkan PR yang dapat direview, berisi:

1. Perubahan konfigurasi dan resolver per produk.
2. Migrasi parameter tersimpan beserta penanda versi dan snapshot sebelumnya.
3. Perubahan API, form superadmin, kalkulator, dan konsistensi ekspor yang diperlukan.
4. Perbaikan tenor/usia PP3 dan validasi tanggal akhir prapen.
5. Regresi isolasi produk, kalender, migrasi, serta kesesuaian parameter layar/backend.
6. Hasil tes yang benar-benar dijalankan.
7. Laporan sebelum/sesudah untuk temuan F01–F09.
8. Daftar perubahan kebijakan, asumsi, atau temuan tambahan yang belum termasuk patch.

PR dianggap selesai ketika konfigurasi per produk benar-benar mengendalikan jalurnya, perubahan satu produk tidak merembet ke produk lain, tanggal akhir melampaui usia ditolak, rekomendasi mengikuti konfigurasi, dan regresi Pensiun biru tetap lulus.

## 16. Rujukan kode dan laporan

Seluruh tautan berikut dipatok ke commit yang diaudit agar sumbernya dapat ditelusuri:

- [Default parameter BSI](https://github.com/roveradmin1st/layanan_pensiun/blob/6df4925e3731230243e9a91ec4f2e69a47499d0e/backend/src/config/default-parameters.js#L44)
- [Form parameter superadmin](https://github.com/roveradmin1st/layanan_pensiun/blob/6df4925e3731230243e9a91ec4f2e69a47499d0e/frontend/src/pages/Settings.jsx#L231)
- [Rekomendasi frontend: DSR fase pensiun](https://github.com/roveradmin1st/layanan_pensiun/blob/6df4925e3731230243e9a91ec4f2e69a47499d0e/frontend/src/pages/Calculator.jsx#L523)
- [Rekomendasi frontend: tanggal akhir](https://github.com/roveradmin1st/layanan_pensiun/blob/6df4925e3731230243e9a91ec4f2e69a47499d0e/frontend/src/pages/Calculator.jsx#L569)
- [Rekomendasi frontend: batas plafon](https://github.com/roveradmin1st/layanan_pensiun/blob/6df4925e3731230243e9a91ec4f2e69a47499d0e/frontend/src/pages/Calculator.jsx#L659)
- [Validasi usia backend prapen](https://github.com/roveradmin1st/layanan_pensiun/blob/6df4925e3731230243e9a91ec4f2e69a47499d0e/backend/src/engines/calc-engine.js#L2410)
- [Jalur hitung Pensiun tersendiri](https://github.com/roveradmin1st/layanan_pensiun/blob/6df4925e3731230243e9a91ec4f2e69a47499d0e/backend/src/engines/calc-engine.js#L680)
- [Profil Simas Pensiun](https://github.com/roveradmin1st/layanan_pensiun/blob/6df4925e3731230243e9a91ec4f2e69a47499d0e/backend/src/config/bsi-pensiun-simas-20260629.js)
- [Suite tes pensiun dan baseline](https://github.com/roveradmin1st/layanan_pensiun/blob/6df4925e3731230243e9a91ec4f2e69a47499d0e/backend/tests/bsi-pensiun-preview.test.mjs)
- [Laporan audit sejuta kasus versi sebelumnya](https://github.com/roveradmin1st/layanan_pensiun/blob/6df4925e3731230243e9a91ec4f2e69a47499d0e/Blue_Print/Audit%202-11-226/Laporan_Audit_BSI_1Juta.md)
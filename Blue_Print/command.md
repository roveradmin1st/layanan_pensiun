Audit bsi-simas-engine.js
Tanggal: 1 November 2026
Kesimpulan
Belum lulus audit perhitungan. Ada kondisi asuransi tidak valid yang tetap menghasilkan overallValid: true, rumus PP10 dan PP3 yang berbeda dari jalur hasil NOS, serta premi yang tidak dihitung ulang ketika plafon diturunkan. File asli tidak diubah dalam audit ini.

Kode berhasil diperiksa sintaksnya dan dapat dijalankan dalam harness terkontrol. Kecocokan tarif tahun penuh dan premi contoh adalah bagian yang sudah bekerja. Namun kecocokan itu belum mencukupi untuk menyatakan hasil pembiayaan atau PDF siap dipakai.
Lingkup dan batas bukti
- Target: bsi-simas-engine.js, 444 baris.
- SHA-256: 1ef57d4e12197e3a450c66872ca99bd9dc314893df060f767127e65808f13219.
- Pembanding: workbook NOS v1.4.6, workbook Simas, ekstraksi master 365 tarif, fixture hasil tersimpan NOS, serta flowchart yang telah disusun.
- File parameter produksi bsiConfig, implementasi AMS2Engine/`StorageService`, UI dan template PDF tidak disertakan. Karena itu audit runtime memakai konfigurasi fixture yang diketahui dan helper tanggal ISO yang ditulis khusus untuk pengujian.
- Semua tier pricing fixture dipatok 9,25% aktif dan 10,50% pensiun untuk menyamai contoh NOS dan mengisolasi kesalahan rumus. Ini bukan verifikasi pricing tier produksi. Adjustment aktif fixture 0,1 poin persentase, pensiun 1 poin persentase, sesuai tahap kapasitas pada source.
- Hasil pembanding PP10 berasal dari nilai cache workbook dan rekonstruksi matematika. Contoh PP3 eligible dihitung dengan rekonstruksi rumus pada 24 bulan aktif, bukan recalc native Excel.
- Uji interpolasi membandingkan perhitungan desimal dengan pembulatan half-up terhadap toFixed. Hasil ini tidak diklaim sebagai 344 penghitungan yang sudah dijalankan ulang di Excel.
Bukti angka contoh PP10
Input fixture: tanggal lahir 24 Oktober 1976, tanggal proses 7 November 2026, BUP 60 tahun, Payroll, penghasilan terakui Rp8.134.916, manfaat pensiun Rp4.600.000, pengajuan Rp480 juta, tenor 180 bulan, aktif 120 bulan dan polis 186 bulan. Atribusi asuransi aktif, EM dan diskon nol.
Ukuran	Pembanding NOS	Hasil kode
Tarif Simas	76,92 per mil	76,92 per mil
Premi yang dimasukkan ke NOS	Rp39.998.267	Rp39.998.267
Angsuran aktif	Rp5.694.441	Rp5.694.441
Rate aktif, tampilan 2 desimal	10,81%	10,89%
Saldo transisi, bulat rupiah	Rp185.564.623	Rp191.406.592
Angsuran pensiun, bulat rupiah	Rp4.121.877	Rp4.247.405
Terima bersih, bulat rupiah	Rp461.161.806	Rp460.910.750


Nilai NOS sebelum pembulatan: angsuran pensiun Rp4.121.876,717674433 dan terima bersih Rp461.161.805,56465113. Selisih pensiun sekitar Rp125.528 per bulan. Dengan parameter ini kode membuat contoh yang sebelumnya berada di bawah batas pensiun Rp4.140.000 menjadi melewati batas.
Temuan menurut prioritas
F01 — P0: asuransi gagal tetapi status akhir tetap lolos
Lokasi: baris 349-364, khususnya 364.

simasResult.valid hanya dipakai untuk label pass atau warn. Nilai itu tidak masuk ekspresi overallValid. Dalam uji, baris tarif usia 50 sengaja dihilangkan dari fixture. Hasilnya:
{
  "insuranceValid": false,
  "premium": 0,
  "overallValid": true,
  "status": "Sesuai — Lolos Akseptasi NOS BSI & Simas Jiwa"
}
Dampak: hasil dapat dinyatakan lolos sekalipun premi tidak dapat dihitung. Perbaikan: hasil akhir harus mensyaratkan asuransi valid serta dependensi perhitungannya lengkap. Tarif hilang perlu status tersendiri dan tidak diganti angka nol pada hasil yang dinyatakan valid. Bedakan simulasi valid dari persetujuan bank/asuransi.

Bukti uji: INVALID_INSURANCE_GATES_OVERALL.
F02 — P1: rate final PP10 memakai rumus tahap kapasitas
Lokasi: baris 249-252.

Kode mengambil rateAktifCalc, plafonMaksNoAtrib, pembulatan ke empat desimal, lalu menambah 0,01. Jalur hasil final pada NOS menggunakan Rumus Plafond + Atrib PP10 (2)!V5:
V3 = P3 * Simulasi!B12 / 12
V4 = atribusi / tenor
V5 = (V3 + V4) / P3 * 12 + IF(atribusi_per_bulan > 0, 0.01, 0)
Dengan demikian rate final memakai plafon yang dihitung untuk hasil nasabah, bukan plafon kapasitas. Tambahan 0,001 pada tahap kapasitas tidak otomatis menjadi bagian rumus V5. Pada fixture, rate benar 10,8055314861%, sedangkan kode menghasilkan 10,89%. Kesalahan mengalir ke saldo transisi, pensiun dan pencairan.

Perbaikan: pisahkan fungsi kapasitas dari fungsi jadwal final dan port dependensi V3:V15 secara tepat. Jangan menyesuaikan konstanta agar hanya satu contoh terlihat cocok.

Bukti uji: lima kegagalan kelompok source_snapshot.
F03 — P1: kapasitas dan rate pensiun PP3 belum mengikuti PP3
Lokasi: baris 216-229 dan 275-278.

Kapasitas PP3 dihitung dengan PV gabungan aktif/pensiun yang sama seperti PP10. Pada source PP3, kapasitas aktif dan pensiun dibandingkan; cabang atribusi memakai minimum C36 dan C44 melalui C46. Rate pensiun final di V16 juga memerlukan RATE dari pembayaran antara, pembulatan dan adjustment, kemudian V17 memakai PMT.

Kode langsung memakai margin saldo ditambah atribusi lalu PMT untuk kedua produk. Langkah RATE PP3 tidak ada.

Pada contoh terkontrol yang eligible untuk jendela PP3: lahir 24 Oktober 1968, proses 1 November 2026, BUP 60, 24 bulan aktif, tenor 180 dan pengajuan Rp200 juta:
Ukuran	Rekonstruksi rumus PP3	Kode
Kapasitas pensiun atribusi pada fixture	Rp320.000.000	Rp400.000.000 sebagai plafon maksimum
Angsuran pensiun, bulat rupiah	Rp2.653.840	Rp2.480.136


Perbaikan: implementasikan cabang PP3 tersendiri, termasuk minimum kapasitas dan RATE/PMT. Tetap uji validasi hasil akhir karena source juga memiliki keterbatasan pemilihan plafon yang telah dicatat sebelumnya.

Bukti uji: PP3_PENSION_FORMULA, PP3_MAXIMUM.
F04 — P1: premi tetap memakai plafon pengajuan saat plafon hasil turun
Lokasi: baris 194-207 dan 232.

Premi dihitung sekali berdasarkan requestedPlafond. Setelah itu plafon dapat turun tanpa menghitung ulang premi. Dalam fixture pengajuan Rp700 juta:
- Plafon yang dipakai kode: Rp486 juta.
- Premi yang masih dipakai: Rp58.330.806, berasal dari pengajuan Rp700 juta.
- Premi bila fungsi asuransi yang sama dijalankan untuk Rp486 juta: Rp40.498.245.
Perbaikan: setiap kandidat plafon harus dihitung bersama premi, santunan dan jadwalnya sendiri. Pilih kandidat terbesar yang memenuhi seluruh batas. Jangan mencampur premi satu plafon dengan jadwal plafon lain. Pemilihan tier pricing juga harus jelas ketika plafon hasil melintasi ambang tier.

Bukti uji: PREMIUM_REQUOTE.
F05 — P1: masa aktif dipotong, bukan divalidasi
Lokasi: baris 169-177.

Math.min(maxActiveCap, monthsToBup) mengubah jendela produk menjadi periode pensiun yang berbeda dari kenyataan. monthsToBup || maxActiveCap juga mengubah nol menjadi 120/36 bulan.

Dua bukti runtime:
- Nasabah dengan sisa masa aktif aktual 120 bulan diberi 36 bulan aktif pada PP3 dan tetap overallValid: true.
- Nasabah lahir 24 Oktober 1966 pada proses 1 November 2026, BUP 60, sudah mencapai tanggal pensiun; kode memberi 120 bulan aktif dan overallValid: true pada fixture tenor 120.
Perbaikan: hitung tanggal pensiun dan periode sebenarnya dahulu. Tolak skema yang di luar jendelanya. Nol bulan aktif harus tetap nol; bila dibutuhkan produk pensiun, gunakan cabang produk tersendiri.

Bukti uji: PP3_WINDOW, ALREADY_RETIRED.
F06 — P1: nearest birthday berbeda dari YEARFRAC basis 0
Lokasi: baris 23-28.

Komentar menyebut YEARFRAC basis 0, tetapi implementasi membagi selisih milidetik dengan 365,25 hari. Source memakai US 30/360.

Contoh tanpa kasus khusus akhir bulan: lahir 24 Oktober 1976, mulai 24 April 2026. Basis 0 memberi 49,5 tahun dan nearest age 50. Kode memberi 49. Selisih satu baris usia mengubah tarif premi.

Perbaikan: port YEARFRAC basis 0 secara benar dan uji akhir bulan, Februari kabisat serta ambang setengah tahun. Jangan menggantinya dengan tahun desimal berbasis 365/365,25.

Bukti uji: NEAREST_30_360.
F07 — P1: batas santunan untuk usia masuk 65 terlewat
Lokasi: baris 59-60.

Kode memilih batas Rp1 miliar atau Rp500 juta hanya dari usia akhir. Spek Produk!F20 menerapkan pengurangan batas bila usia masuk lebih dari 64, atau usia ditambah masa polis melebihi 70.

Uji usia 65, tenor polis 5 tahun dan santunan Rp600 juta tanpa gross-up dikembalikan valid: true, batas Rp1 miliar. Source menetapkan batas Rp500 juta pada usia masuk tersebut.

Perbaikan: terapkan seluruh kondisi batas, lalu periksa santunan sebelum dan sesudah gross-up.

Bukti uji: UP_AGE_65.
F08 — P1: batas masa polis dan lookup wajib belum lengkap
Lokasi: baris 35-41, 65-75 dan 111.
- Batas masa asuransi 20 tahun dari Spek Produk!I22 tidak diperiksa. Usia 45, polis 246 bulan tetap valid: true dengan tarif 20 tahun.
- Bila tarif tahun berikutnya kosong, interpolasi diam-diam memakai tarif tahun penuh sebelumnya.
- Bila faktor bulanan hilang, fallback menjadi 1,00. Uji satu bulan menjadi sebesar tarif setahun.
- Diskon 10% diterima walau validasi source 0-5%. Nominal santunan nol juga dinyatakan valid.
Perbaikan: validasi bilangan bulat bulan, masa maksimum, nilai santunan positif, rentang diskon serta keberadaan kedua tarif/faktor sebelum menghitung. Tarif dan faktor yang hilang bukan nilai nol atau faktor 1.

Bukti uji: MAX_INSURANCE_20Y, INTERPOLATION_REQUIRES_Y2, MISSING_MONTH_MULTIPLIER, DISCOUNT_ABOVE_5, ZERO_INSURED.
F09 — P1: fraksi gross-up yang tidak sah masih dinyatakan valid
Lokasi: baris 82-85 dan 111.

Ketika fraksi premi termasuk EM mencapai atau melebihi 1, kode melewati pembagian gross-up dan tetap memakai santunan dasar. Kondisi ini tidak dimasukkan ke valid.

Uji usia 54, polis 10 tahun, plafon Rp100 juta, EM 2.000% dan gross-up aktif menghasilkan premi Rp136.122.000, santunan Rp100 juta dan valid: true. Premi melebihi santunan dasar tanpa rekonsiliasi gross-up yang benar. EM besar di sini dipakai sebagai uji batas matematika, bukan rekomendasi tarif underwriting.

Perbaikan: tolak fraksi yang tidak memenuhi syarat matematika dan batas parameter yang ditetapkan. Periksa invariant santunan akhir dikurangi premi sama dengan santunan dasar pada gross-up.

Bukti uji: INVALID_GROSSUP_Q.
F10 — P1: blokir PP3 masih dihitung seperti PP10
Lokasi: baris 311-313.

Kode memakai satu blokirActiveCount untuk kedua skema. Source Simulasi!B37 untuk PP3 memakai seluruh bulan aktif dikali angsuran aktif, ditambah dua angsuran pensiun. Pada contoh 24 bulan aktif dan angsuran aktif bulat Rp1.728.442, bagian aktif seharusnya sekitar Rp41.482.608, tetapi kode hanya Rp1.728.442 dengan konfigurasi contoh 1x aktif.

Perbaikan: formula blokir per produk. Jangan menambal dengan mengganti satu konfigurasi global yang akan merusak produk lainnya. Pembulatan sebelum/sesudah perkalian tetap perlu dipastikan untuk hasil rupiah terakhir.

Bukti uji: PP3_ACTIVE_BLOCK.
F11 — P1: label payroll sumber dapat masuk cabang yang salah
Lokasi: baris 151-158.

Kode hanya mengenali string Non-Payroll. Source memakai Non Payroll dan memiliki Comitted Payroll sebagai pilihan ketiga.

Pada input identik, Non-Payroll menghasilkan kapasitas aktif Rp4.067.458, sedangkan Non Payroll menghasilkan Rp5.694.441 karena dianggap Payroll. Status ketiga tidak dimodelkan terpisah. Selain itu satu existingInstallment tidak mewakili pemisahan kewajiban BSI dan non-BSI pada source.

Perbaikan: normalisasi label menjadi enum P/C/N dan validasi nilai yang tidak dikenal. Port ceiling, DSR pilihan dan pengurangan kewajiban masing-masing cabang. Ceiling 80% untuk Committed tidak berarti selalu memakai 80%; source mengambil minimum dengan DSR pilihan, yang pada contoh bisa 70%.

Bukti uji: PAYROLL_SOURCE_LABEL; status ketiga dan pemisahan kewajiban juga temuan statis.
F12 — P1: saldo dilunaskan secara paksa dan jadwal terputus
Lokasi: baris 255-270, 280-294 dan 433.

Math.max(0, saldo - pokok) menutupi saat pokok yang dibayar melampaui saldo. Angsuran tetap berjalan setelah saldo nol. openingOs dihitung ulang dari saldo yang sudah di-clamp sehingga tidak lagi sama dengan saldo akhir bulan sebelumnya.

Pada fixture plafon Rp10 juta, ada lima ketidakcocokan saldo antarbaris preview yang berurutan. Baris setelah lunas masih menampilkan angsuran/pokok Rp5.694.441. Preview hanya berisi 9 baris pada tenor 180 bulan; tidak ada jadwal penuh yang dikembalikan untuk rekonsiliasi mandiri.

Perbaikan: pertahankan opening balance asli, tangani pelunasan lebih awal sesuai aturan dan hentikan jadwal ketika lunas. Jangan menghapus saldo bermasalah melalui clamp. Kembalikan jadwal penuh, saldo terakhir dan total komponen; preview menjadi subset dari jadwal tersebut.

Bukti uji: OVERPAYMENT_MASKED, SCHEDULE_CONTINUITY, FULL_SCHEDULE_UNAVAILABLE.
F13 — P1: input kosong/nol dan parameter pengguna diganti diam-diam
Lokasi: baris 130, 140, 175, 192-200 dan 203-207.
- Manfaat pensiun nol diganti Rp3.191.100, yaitu 75% gaji pokok pada fixture. Formula pengganti ini tidak berasal dari input manfaat pensiun source.
- Tenor 181 bulan diubah menjadi 180 tanpa pesan invalid untuk nilai yang diminta.
- Masa polis selalu tenor + 6, walau hubungan ini belum dipastikan dalam percakapan.
- Pemanggilan terintegrasi selalu mengirim diskon dan EM nol. Uji input extraEmPercent: 50 tetap memberi extra premi nol, sedangkan fungsi Simas mandiri dengan parameter sama menghasilkan extra Rp20.868.622.
- Tanggal proses kosong berubah menjadi waktu sekarang, tidak lagi perhitungan yang tanggal acuannya tetap.
- Override premi mengubah nominal atribusi tanpa menyelaraskan seluruh rincian premi/santunan yang dilaporkan.
Perbaikan: validasi data wajib, bedakan kosong dan nol, jangan mengarang pendapatan, dan terima parameter polis/underwriting secara eksplisit. Sediakan kebijakan pembulatan premi dan metadata override bila fitur itu memang diminta. Pemisahan atribusi bank dari gross-up asuransi juga belum tersedia karena keduanya memakai atribusiMode yang sama.

Bukti uji: ZERO_BENEFIT_SUBSTITUTED, EM_INPUT_IGNORED, TENOR_SILENTLY_CHANGED; sisanya penelusuran statis.
F14 — P1: plafon minimum source tidak diterapkan
Lokasi: baris 179, 330 dan 363-364.

Plafon hanya diperiksa lebih besar dari nol, bukan minimum Rp10 juta pada blueprint. Dalam fixture dengan penghasilan dan manfaat pensiun Rp500.000, pengajuan Rp1 juta dikembalikan overallValid: true. Penghasilan itu dipakai untuk membuktikan jalur minimum plafon tidak ada, bukan untuk menyatakan kelayakan nasabah menurut RAC produksi.

Perbaikan: batas minimum/maksimum produk harus menjadi validator eksplisit. Jangan bergantung pada pencairan negatif untuk kebetulan menolak plafon kecil. Ekspresi plafonMaksNoAtrib || requestedPlafond di baris 232 juga perlu dihapus agar kapasitas nol tidak berubah menjadi plafon permintaan.

Bukti uji: BELOW_10M.
F15 — P2: pencairan tidak mendukung buka blokir lama
Lokasi: baris 314-319 dan 406-430.

Rumus pencairan hanya mengurangi takeover. Tidak ada komponen yang menambah buka blokir lama, padahal output yang diminta memerlukannya. Uji dua input dengan dan tanpa buka blokir Rp1 juta menghasilkan pencairan yang sama. Nama properti uji adalah usulan kontrak, karena schema UI tidak disertakan; bukti utamanya adalah tidak adanya suku penambah pada formula baris 318.

Perbaikan: definisikan kontrak nominal pelunasan dan buka blokir yang eksplisit, termasuk status memang tidak ada atau belum diisi. Gunakan formula lengkap rincian nasabah. Jangan menganggap seluruh pelunasan lama selalu takeover.

Bukti uji: BLOCK_RELEASE_MISSING dan penelusuran formula.
F16 — P2: pembulatan biner dan hilangnya nilai mentah perlu diperbaiki
Lokasi: baris 79, 91, 117-120, 246, 308-319 dan 393-427.

Tarif tahun penuh seluruhnya cocok dalam fixture. Namun 90 dari 344 kombinasi usia/tenor dengan tambahan enam bulan berbeda 0,01 per mil dari perhitungan desimal half-up. Contoh usia 45, masa 4 tahun 6 bulan: tarif tahun 4 adalah 12,08 dan tahun 5 adalah 15,03. Titik tengahnya 13,555, sehingga pembulatan desimal menghasilkan 13,56, sedangkan kode mengembalikan 13,55.

Ini membuktikan toFixed pada floating point bukan pengganti yang andal untuk aturan desimal. Kesetaraan terhadap Excel pada titik batas tetap perlu uji native, sebagaimana batas lingkup di awal laporan.

Selain itu sebagian besar hasil uang yang dikembalikan sudah dibulatkan ke rupiah penuh, padahal rincian source menampilkan sen. Tanpa nilai mentah sulit menelusuri selisih dan menjaga rekonsiliasi setelah koreksi rumus.

Perbaikan: hitung desimal/pembulatan yang ditetapkan secara konsisten; simpan hasil mentah dan hasil tampilan terpisah. Jangan memperbaiki seluruh masalah finansial hanya dengan menambah EPSILON di semua operasi.
Ringkasan pengujian
Kelompok	Jumlah	Cocok	Tidak cocok
Helper PMT/PV biasa dan zero rate	3	3	0
Tarif tahun penuh dari master yang dipasok auditor	365	365	0
Interpolasi enam bulan vs desimal half-up	344	254	90
Angka utama snapshot NOS	11	6	5
Kontrol risiko dan kebutuhan hasil	25	1	24
Total	748	629	119


Jumlah kegagalan pengujian bukan jumlah bug yang terpisah. Beberapa kegagalan berasal dari akar masalah yang sama. Persentase lolos keseluruhan tidak boleh dipakai sebagai ukuran siap pakai karena F01 merupakan kegagalan status yang kritis.

Yang bekerja dalam fixture: sintaks, PMT/PV sederhana, pengambilan 365 tarif tahun penuh, tarif/premi contoh usia 50 selama 186 bulan, pendapatan terakui contoh dan angsuran aktif contoh. Master tarif produksi asli aplikasi belum dapat dinilai karena tidak dilampirkan.
Urutan perbaikan untuk Gemini
1. Perbaiki F01: pisahkan status error, aturan belum lengkap, tidak eligible dan hasil valid; jangan izinkan premi gagal berujung lolos.
2. Perbaiki F05/F06: tanggal, nearest birthday, periode aktual dan eligibility produk sebelum uang dihitung.
3. Perbaiki F07-F09: batas asuransi, tarif/faktor yang hilang, tenor polis dan gross-up.
4. Port ulang jalur final PP10 dan PP3 secara terpisah; jangan menggunakan formula kapasitas sebagai rate jadwal final.
5. Implementasikan pencarian plafon dengan premi dan pricing yang selalu sesuai kandidatnya.
6. Perbaiki jadwal dan rekonsiliasi, kemudian blokir dan seluruh komponen pencairan.
7. Hilangkan fallback pendapatan/tenor yang tidak disepakati; normalisasi input/payroll dan pisahkan atribusi bank dari gross-up asuransi.
8. Sediakan konfigurasi masa polis dan tanggal; jangan menganggap snapshot +6 bulan sebagai ketentuan universal.
9. Simpan raw result dan format hanya pada UI/PDF. Satu hasil dipakai untuk keduanya.
10. Jalankan fixture pembanding dan uji invalid lagi. Sesuaikan adaptor pengujian bila kontrak API/error diubah; jangan mengubah expected agar mengikuti kode yang salah.
Cara mengulang audit
Paket bukti menyertakan audit_engine.mjs, audit-fixture.json, audit-results.json dan README. Letakkan fixture di sebelah script, lalu:
TZ=Asia/Jakarta node audit_engine.mjs /path/to/bsi-simas-engine.js audit-results.json
Tidak memerlukan paket npm tambahan. Script memuat engine dalam konteks VM untuk pengujian, tanpa mengubah file. Harness ini adalah reproduksi audit terhadap kontrak file terlampir, bukan sertifikasi atau suite penerimaan lengkap semua versi aplikasi. Setelah kontrak error/API berubah, adaptor uji perlu diselaraskan tanpa melemahkan kriteria hasilnya.

Untuk audit integrasi berikutnya, dibutuhkan konfigurasi bsiConfig yang sebenarnya, kode AMS2Engine/`StorageService`, serta bagian UI dan pembuat PDF. Tanpa berkas tersebut, normalisasi input UI, master produksi, gating ekspor dan kecocokan PDF belum dapat diverifikasi.
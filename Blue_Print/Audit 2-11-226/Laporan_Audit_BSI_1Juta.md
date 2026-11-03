# Audit simulasi 1.000.000 calon nasabah BSI

Tanggal audit: 2 November 2026. Status: **uji banding rumus selesai; sertifikasi kesetaraan dengan Microsoft Excel belum lulus.**

Sebanyak 1.000.000 data sintetis benar-benar dijalankan melalui `calculatePreview` backend dan evaluator independen yang membaca formula dari dua workbook BSI. CSV lengkap memiliki 1.000.000 ID berurutan dan 1.000.000 sidik input berbeda. Tidak ada exception aplikasi atau kegagalan implementasi evaluator yang tercatat. Ini bukan satu juta kalkulasi ulang Microsoft Excel desktop.

**Kesimpulan yang dapat dipakai sekarang**

Kode memiliki aturan yang berbeda dari template pada pembulatan plafon, perlakuan cicilan berjalan, dan potongan pencairan. Tanggal BUP mengikuti aturan tahun yang sama dengan workbook; kesamaan itu belum menyelesaikan ambiguitas label TMT untuk kelahiran Desember. Jangan menyatakan seluruh hitungan sudah benar atau menerapkan perubahan uang secara massal berdasarkan jumlah selisih di bawah: verifikasi native untuk angsuran pensiun dan pencairan belum konsisten.

**Sumber dan lingkup**

- Repository: https://github.com/roveradmin1st/layanan_pensiun
- Checkout yang diuji: `52ac0b883d903bca2dd35c3dd3ca43a8243d662f` pada main. Engine dan parameter sama pada branch terbaru yang diperiksa, `fix/security-and-operational-integrity`, commit `2d247da1447c8e862088081cc8cddbc198b51ac1`.
- Fungsi: `backend/src/engines/calc-engine.js`, memakai `DEFAULT_PARTNER_PARAMETERS`. Frontend memanggil backend melalui `/calc/preview`. Parameter tersimpan pada instalasi produksi tidak diperiksa.
- Workbook: `Blue_Print/Rumus BSI/Kalkulator Prapen NOS  v.1.4.6 ok.xlsx` dan `Simas Prapensiun.xlsm`. Sheet tersembunyi ikut dibaca. SHA-256 seluruh sumber ada dalam protocol dan manifest.
- Uji langsung fungsi perhitungan; tidak menguji HTTP, login, database, kapasitas VPS, atau 1.000 pengguna bersamaan.

**Data dan kendali pengujian**

Seed: `20261102`, generator `v2-valid-payroll-cartesian-72`. Semua 72 kombinasi PP10/PP3 × tiga payroll × atribusi/nonatribusi × BUP 58/60/65 × dua akad tercakup. Ada 500.000 kasus umum termasuk satu baseline, 250.000 batas masa aktif, 150.000 variasi kalender/tahun, dan 100.000 batas validasi.

Variasi meliputi tanggal lahir/akhir bulan/Desember, tanggal proses 2025–2028, gaji, uang makan, tunjangan bulanan, manfaat pensiun, kewajiban BSI dan non-BSI, plafon, tenor, pricing, diskon dan EM asuransi. Beberapa kasus sengaja melewati batas produk. TMT bekerja ditahan pada tahun 2000 untuk konteks keluhan; `2000-01-01` adalah representasi sintetis karena hari/bulan sebenarnya belum diberikan. Tunjangan tiga bulanan, THT, takeover dan buka blokir lama tidak divariasikan; cakupan ini tidak berarti seluruh kombinasi aturan bisnis sudah diuji.

Adapter yang dinyatakan secara terbuka:

1. Tanggal proses dibekukan pada input kasus pada NOS `Akseptasi!C24`, `Simulasi!B5`, dan Simas `E32`, menggantikan volatilitas NOW/lead time default workbook.
2. Simas `E58` dihitung, dibulatkan ke rupiah, lalu dipindahkan ke NOS `Akseptasi!C28`, sesuai alur transfer manual antarbuku.
3. Payroll memakai label yang dikenali engine: `Payroll`, `Comitted Payroll`, dan `Non Payroll`, dengan DBR pilihan 70/80/50. Label driver NOS `Simulasi!A16` diselaraskan; formula pembaca persentasenya tetap berasal dari workbook. Ini penyesuaian driver, bukan klaim template otomatis mengganti label tersebut.
4. Referensi eksternal `Rincian ke Nsb!D22/D24` serta J22/J24 diberi input eksplisit nol untuk buka blokir/pelunasan lama. Cache tautan eksternal tidak dianggap hasil baru.
5. Jenis pertanggungan Simas tetap Menurun. Tanggal lahir yang tidak sah dipertahankan sebagai input tidak sah pada pembanding.

Toleransi uang Rp1; tanggal, bulan dan usia harus sama; tarif asuransi 0,0000001 permil; pricing tahunan 0,00500001 poin persentase mengikuti tampilan kode dua desimal. Output teks/error workbook dipisahkan dari angka. Selisih pada kasus ditolak atau output undefined tidak otomatis disebut bug.

**Hasil agregat evaluator rumus**

| Kelompok | Jumlah kasus |
|---|---:|
| Seluruh kasus selesai | 1.000.000 |
| `overall_ok=true` menurut aplikasi | 176.708 |
| Lolos aplikasi, plafon positif, tenor input 1–180 | 172.515 |
| Kelompok tersebut dengan seluruh 14 metrik pembanding berupa angka | 146.529 |
| Cocok pada seluruh 14 metrik | 9.467 |
| Berbeda pada sedikitnya satu metrik | 137.062 |
| Output pembanding belum seluruhnya numerik pada kelompok 172.515 | 25.986 |

`overall_ok` adalah keputusan kode yang sedang diuji, bukan penilaian kelayakan independen dari bank. Jumlah selisih bukan jumlah bug terkonfirmasi; banyak kasus berbeda pada plafon maksimum saja.

Pada 146.529 kasus yang outputnya lengkap berupa angka:

| Metrik | Kasus berbeda |
|---|---:|
| Tanggal BUP, sisa bulan aktif, penghasilan diakui | 0 masing-masing |
| Usia, tarif, premi dan UP asuransi | 0 masing-masing |
| Plafon maksimum | 118.910 |
| Plafon simulasi/permintaan dibanding plafon yang dibatasi workbook | 114 |
| Angsuran aktif | 18.471 |
| Angsuran pensiun | 19.755 |
| Pricing aktif | 50 |
| Pricing pensiun | 10.579 |
| Pencairan bersih | 88.705 |

Di seluruh 172.515 kasus lolos aplikasi dengan nominal positif dan tenor valid, premi juga cocok dalam toleransi Rp1. Di seluruh satu juta data, tanggal BUP cocok untuk 990.000 tanggal lahir valid; 10.000 tanggal tidak sah tidak dimasukkan sebagai kecocokan tanggal. Ada 64.308 selisih sisa bulan di luar kelompok lolos aplikasi karena workbook dapat memberi bulan negatif, sedangkan kode membatasi ke nol.

**Batas verifikasi native yang wajib diketahui**

Uji silang memakai LibreOfficeDev 26.8.0.0.alpha0, bukan Microsoft Excel. Pada salinan workbook Simas, 29 kasus dengan driver input yang cocok menghasilkan 145 perbandingan; satu kasus memiliki dua perbedaan representasi nonnumerik: kosong versus string kosong dan format pemisah ribuan pada pesan batas UP. Tidak ditemukan selisih angka pada sampel Simas tersebut. Enam keluaran lama yang inputnya tidak cocok tidak dihitung.

Pada tiga sampel pasangan workbook NOS–Simas, baseline cocok, tetapi dua sampel berbeda pada angsuran pensiun/pencairan; satu juga pada pricing pensiun. Contoh case 2: evaluator dan kode menghitung angsuran pensiun Rp858.031,76, sedangkan hasil konversi Calc memberi Rp4.092.900,05. Plafon maksimum case 2 tetap Rp518 juta pada evaluator dan Calc, sedangkan kode Rp510 juta.

Penyebab ketidaksamaan native pada jalur jadwal/ketergantungan sel/cache/adapter belum dipastikan. Percobaan normalisasi dependensi tidak menjadi bukti lulus. Karena itu angka angsuran pensiun, pricing pensiun, pencairan, dan persentase cocok menyeluruh di laporan ini berstatus **hasil eksplorasi evaluator rumus**, belum hasil yang disahkan dari Excel native. Resolusi sampel native yang gagal merupakan prasyarat sebelum menjadikannya acuan otomatis untuk mengubah engine.

**Temuan yang dapat ditindaklanjuti**

1. **Pembulatan plafon PP3 berbeda.** `computeBsiCandidateMaxPlafond` membulatkan kapasitas PP3 per Rp10 juta. Formula plafon pada sheet `Rumus Plafond + Atrib PP3` memakai satuan Rp1 juta. Pada case 2, permintaan Rp50 juta/120 bulan dan masa aktif 24 bulan menghasilkan maksimum kode Rp510 juta versus Rp518 juta pada evaluator maupun Calc. Angsuran aktif sama, sekitar Rp441.200,46. Ini perbedaan aturan; tetapkan satuan yang disetujui BSI sebelum mengubahnya.
2. **Cicilan berjalan diperlakukan berbeda.** Pada PP10 Payroll, sumber `Simulasi!G4/I4` tidak memasukkan cicilan non-BSI B20 seperti pengurangan pada `evaluateBsiCore`. Case 43 memiliki cicilan non-BSI Rp813.510: angsuran aktif kode Rp3.385.783 versus rumus workbook Rp4.199.293. Selisih tepat sebesar cicilan tersebut. Putuskan formula DBR yang berlaku; perubahan ke template tanpa keputusan bank dapat melonggarkan penilaian kemampuan bayar.
3. **Potongan premi nonatribusi berbeda.** Kode mengurangi premi asuransi untuk nonatribusi pada pencairan bersih. Formula `Rincian ke Nsb!D26/J26` tidak mengurangi premi tersebut; D15/J15 pada sumber bernilai nol dan tidak masuk formula net. Kesetaraan kas belum memiliki acuan bisnis tunggal. Konfirmasi siapa membayar premi, dari sumber dana mana, dan apakah template membutuhkan langkah manual lain.
4. **Input nol memiliki arti otomatis di kode.** Ada 2.957 input plafon nol dan 1.236 tenor nol yang ditafsirkan sebagai fallback/otomatis dan berakhir `overall_ok=true`. Semua 2.957 selisih premi pada kelompok lolos aplikasi berasal dari plafon nol ini. Nilai nol pada workbook memiliki arti berbeda. Definisikan mode maksimum secara eksplisit; pisahkan validasi mode permintaan dengan plafon dan tenor wajib positif.
5. **Template bermasalah pada sebagian skenario tanpa fase pensiun.** Case 62 meminta tenor 15 bulan dengan sisa aktif 20 bulan. Kode dapat menghitung pelunasan pada masa aktif, sementara rumus sumber menghasilkan maksimum negatif dan output pensiun `#NUM!`. Buat keputusan apakah produk mengizinkan skenario tersebut. Output error/negatif tidak boleh dipakai sebagai oracle kelayakan tanpa klasifikasi.

**Kasus lahir 26/12/1967**

Dengan tanggal proses 02/11/2026, hasil kode dan formula memakai aturan berikut. Ini reproduksi implementasi, bukan penetapan hak pensiun nasabah.

| BUP input | Tahun input | Tanggal yang dihasilkan keduanya |
|---|---|---|
| 58 | Otomatis atau 2025 | 01/01/2026 |
| 60 | Otomatis atau 2027 | 01/01/2028 |
| 60 | 2028, bila operator bermaksud tahun TMT efektif | 01/01/2029 |
| 65 | Otomatis atau 2032 | 01/01/2033 |

Untuk kelahiran Desember, tahun mencapai usia BUP dan tahun TMT efektif berbeda. Field `tmt_pensiun_year` saat ini digunakan sebagai tahun mencapai usia, kemudian bulan ditambah satu. Mengisi tahun TMT efektif dapat menambah satu tahun lagi. Perbaikannya harus memisahkan tahun mencapai usia, tanggal pensiun efektif, dan TMT bekerja. Jangan menerapkan `tahun - 1` untuk semua nasabah. Acuan tanggal/usia yang tepat perlu SK atau aturan produk yang berlaku pada nasabah.

**Urutan kerja tim AI**

1. Bekukan workbook, hash engine, snapshot parameter dan kontrak input. Reproduksi case 1, 2, 43 dan 62; pertahankan data sintetisnya sebagai regresi.
2. Selesaikan perbedaan native case 2/3 memakai Microsoft Excel `CalculateFullRebuild`, lalu validasi 256 kasus golden yang disertakan. Skrip PowerShell disediakan sebagai calon runner; belum dijalankan atau divalidasi pada Windows/Excel dalam audit ini.
3. Konfirmasi aturan BUP/TMT, pembulatan PP3, pengurangan kewajiban, premi nonatribusi, dan tenor yang selesai saat masih aktif. Catat versi dan tanggal berlaku. Daftar selisih diberi label: bug kode, kekurangan template, perbedaan aturan disetujui, input tidak sah, atau evaluator/adapter belum terverifikasi.
4. Setelah oracle dan aturan disahkan, ubah komponen kecil secara terpisah, tambahkan regresi yang relevan, lalu jalankan ulang sejuta kasus dengan seed sama. Simpan bukti sebelum/sesudah per metrik.
5. Gerbang rilis: tidak ada selisih uang di atas toleransi pada domain yang disepakati, tanggal tepat, semua status tidak sah jelas, dan seluruh kegagalan native penting terselesaikan. Jalankan uji beban secara terpisah bila akan menilai infrastruktur.

Tidak ada perubahan kode aplikasi, data produksi, atau deployment dari audit ini. Paket bukti berisi CSV sejuta kasus, ringkasan, kasus ulang, generator, evaluator, adapter dan instruksi reproduksi. Formula JSON mentah serta salinan workbook tidak diduplikasi; keduanya dapat diekstrak ulang dari repository yang dirujuk.

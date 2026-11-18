# Pengembangan dan demo kalkulator BNI Fleksi

Branch `fix/bni-demo-compat-20261118` meneruskan review `862d2ae`. Uji kompatibilitas memakai konfigurasi sintetis dari baseline produksi `6a791a34b4f90111fabe3e5ce55fef08a8395913` yang tercatat pada 15 November 2026. Siapkan demo dengan database dan akun sintetis yang terpisah dari layanan produksi.

## Perhitungan

- Gunakan Reguler (kode 1) untuk tenor 1–132 dan 145–180 bulan, serta Pra Purna (kode 4) untuk tenor 1–180 bulan. Keduanya menggunakan AJK CAR skema Menurun. Batas usia dan konfigurasi BNI dapat memperpendek tenor yang tersedia.
- Gunakan bunga tahunan dibagi 12 untuk PMT dan PV, dalam satuan desimal. Plafon maksimum adalah nilai terkecil dari PV kemampuan angsuran, batas plafon BNI yang tersimpan, dan batas tabel underwriting. Simpan presisi antara dan bulatkan plafon otomatis ke bawah.
- Tentukan tarif AJK dari usia genap saat tanggal aplikasi dan tenor yang dibulatkan ke atas ke tahun. Premi kotor adalah plafon dibagi 1.000 dikali tarif permil. Subsidi mengikuti parameter BNI dan selisihnya menjadi premi nasabah. Biaya bank memakai biaya tetap dan persentase masing-masing produk.
- Hitung pencairan dengan mengurangkan biaya bank, premi nasabah, seluruh blokir, dan take over dari plafon. Validasi tanggal jatuh tempo akhir bulan terhadap tanggal usia 75 tahun. Perhitungan sisa bulan mengikuti tanggal aplikasi yang dimasukkan.
- Bandingkan kategori underwriting dari header usia dengan hasil rumus B68. Jika berbeda, tampilkan status **Perlu verifikasi aturan asuransi**. Simulasi tetap dapat disimpan dan diunduh. Pengajuan dari simulasi tersebut menunggu konfirmasi.

## API dan antarmuka

| Operasi | Perilaku yang perlu dijaga |
| --- | --- |
| `GET /api/banks` dan `GET /api/calc/limits` | Status dan batas BNI mengikuti konfigurasi aktif serta cakupan bank pengguna. |
| `POST /api/calc/max` dan `POST /api/calc/preview` | Mesin BNI hanya menangani `bank_bni`. Produk atau tenor yang belum didukung menghasilkan `UNAVAILABLE`. |
| `POST /api/simulations` | Server menghitung ulang dari input. Jika revisi pada preview sudah berganti, `expected_bni_policy_revision` menghasilkan HTTP 409 agar pengguna menghitung ulang. |
| `PUT /api/calc/params/bank_bni` | Ubah DBR default atau subsidi. Admin Ops mengajukan usulan dan Super Admin berwenang menerapkan perubahan. Tarif, biaya produk, dan matriks AJK mengikuti konfigurasi sumber. |
| Unduh PDF dan SVG | Periksa izin terhadap simulasi. Hasil dikirim sebagai lampiran dengan `no-store`. Nilai teks SVG di-escape agar karakter nama tetap utuh. |

Di kalkulator, DBR awal dan reset mengikuti pengaturan BNI. Pengguna dapat memilih DBR lain secara eksplisit. Tombol **Contoh Uji** memuat DBR 90% untuk mereproduksi acuan sintetis BNI-01. Untuk menguji DBR default, isi profil sendiri atau pilih kembali opsi default setelah memuat contoh. Sesudah preview, simpan untuk menampilkan aksi unduh.

## Aktivasi pada database baseline

1. Pada instance demo, jalankan versi kandidat dengan `NODE_ENV=production` dan SQLite sintetis. Saat boot, backend memvalidasi database. Profil BNI lama yang nonaktif tetap menunggu tindakan Super Admin.
2. Masuk dengan Super Admin berizin BNI, buka **Pengaturan → Bank BNI → Aktifkan BNI Fleksi**. API yang setara adalah `POST /api/calc/params/bank_bni/activate` dengan JSON `{"confirm": true}`. Jika konfigurasi asal kurang lengkap atau profil bukan legacy yang dikenali, periksa konfigurasi sebelum aktivasi.
3. Proses API menyimpan parameter Fleksi pada `partner_parameters.bank_bni.fleksi` dalam satu transaksi bersama snapshot dan log audit. DBR default, batas plafon, dan batas tenor bawaan profil lama dibawa ke Fleksi dalam batas dukungan produk. Profil luar tetap dapat dibaca oleh rilis `6a791a3`. Pengulangan menghasilkan `already_active`.
4. Uji bahwa kalkulator tersedia setelah restart. Bandingkan akun, status aktif, hash kata sandi, cakupan bank, relasi SM–Marketing, transaksi, BLOB, serta parameter bank lain dengan salinan sebelum aktivasi. Jalur aktivasi memakai penulis SQLite yang sama dengan layanan aplikasi.

Lakukan validasi rilis produksi melalui controller yang sudah terpasang sesuai [runbook](RUNBOOK.md). Pakai commit yang disetujui, snapshot SQLite konsisten, dan bukti status server terbaru. Uji rollback kode pada salinan SQLite. Profil lama dan data yang masuk setelah aktivasi tetap tersedia pada salinan uji ketika dibuka dengan modul database baseline.

## Latihan demo

| Skenario | Hasil yang perlu terlihat |
| --- | --- |
| Pra Purna BNI-01 | Gunakan **Contoh Uji**. Plafon Rp100 juta, tenor 50 bulan, angsuran Rp2.477.899,58 dan terima bersih Rp60.659.405,81 pada tampilan. |
| Reguler | Lahir 10 Maret 1962, aplikasi 10 Agustus 2026, gaji Rp5 juta, plafon Rp80 juta, tenor 60 bulan, take over Rp10 juta. Bunga 11,80%, biaya bank Rp3.040.000 dan blokir prapensiun 0. |
| Tenor dan produk terbatas | Pilih Reguler 140 bulan atau kode 2. Tampilkan alasan belum tersedia dan pastikan tombol simpan tidak muncul. |
| Perbedaan underwriting | Reguler, lahir 31 Oktober 1954, aplikasi 17 November 2026, gaji Rp3.759.100, plafon Rp30 juta dan tenor 24 bulan. Tampilkan verifikasi asuransi dan uji simpan, unduh, serta penahanan pengajuan. |
| Default DBR dan akses | Ubah parameter lewat Super Admin. Form Marketing baru dan reset memakai nilai default terbaru. SM pembina melihat simulasi timnya. Akun `bsi_only` dan SM lain mengikuti cakupan yang berlaku. |

Jalankan dari checkout demo dengan Node sesuai `.node-version`. Kedua rangkaian memakai database sementara. Flag `--system-chromium` memakai Chromium yang terpasang.

```bash
node --version
npm --prefix backend ci --omit=dev
npm --prefix frontend ci --include=dev
python3 ops/ci.py --skip-install --browser --system-chromium
node backend/tests/bni-ui-e2e.mjs --system-chromium
```

Saat membahas rilis dengan klien, minta ketetapan underwriting untuk 54 kombinasi yang berbeda di Excel dan keputusan apakah DBR adalah default atau batas kredit. Cakupan produk 2/3, skema selain Menurun, bunga Reguler pada 133–144 dan tenor 181–240 tetap menunggu acuan bisnis. Presentasikan angka yang telah diuji sebagai estimasi dalam cakupan demo.

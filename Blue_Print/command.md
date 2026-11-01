Kerjakan perbaikan repository `roveradmin1st/layanan_pensiun` berdasarkan brief teknis terlampir.

Baseline audit: `52ac0b883d903bca2dd35c3dd3ca43a8243d662f`. Jika repository sudah berubah, periksa kembali temuan terhadap HEAD terbaru sebelum memperbaikinya.

**Tujuan:** memperbaiki keamanan dan integritas operasional sambil mempertahankan hasil perhitungan yang telah cocok dengan Excel.

1. **Buat baseline pengujian terlebih dahulu.**

   Baca workbook BSI beserta sheet tersembunyinya. Jadikan fixture PP10 dalam brief sebagai tes regresi deterministik. Contohnya memakai plafon Rp480 juta, tenor 180 bulan, price aktif 9,25%, dan price pensiun 10,50%.

   Expected utama: premi Rp39.998.267; angsuran aktif Rp5.694.441; angsuran pensiun Rp4.121.877; terima bersih Rp461.161.806.

   Pertahankan expected tersebut. Perubahan rumus harus didukung bukti selisih terhadap sumber yang telah diperiksa.

2. **Tutup bypass autentikasi.**

   Hapus password universal pada login/change-password. Nonaktifkan Quick Role dalam produksi. Produksi harus gagal startup jika JWT secret tidak dikonfigurasi dengan aman. Header, query demo, hostname, dan status PWA tidak boleh memberi kewenangan.

3. **Terapkan otorisasi pada seluruh operasi API.**

   Periksa role, cabang, penugasan, objek, dan tindakan. Terapkan pada detail, update, upload, download, export, serta perubahan status. Gunakan allowlist field untuk mencegah mass assignment.

   Marketing tetap boleh mengajukan simulasi valid miliknya sesuai kebijakan. Pengajuan simulasi berbeda dari persetujuan bank atau klaim.

4. **Tegakkan aturan bisnis di backend.**

   Blokir pengajuan dari hasil `overall_ok=false`. Batasi persetujuan dan perubahan nominal klaim kepada pihak berwenang. Tolak nominal negatif, klaim sebelum booking, klaim ganda, serta pembayaran tanpa persetujuan dan bukti. Gunakan transaksi dan perlindungan request berulang.

5. **Uji sebelum memperluas perubahan.**

   Jalankan pengujian API langsung untuk kasus sah dan terlarang. Setiap penolakan harus memastikan data tidak berubah. Fixture PP10 wajib tetap lulus.

   Setelah tahap ini lulus, lanjutkan penyimpanan, backup/restore, dokumen, dan UI/UX sesuai brief.

Catatan: `Blue_Print/command.md` membahas engine versi sebelumnya. Verifikasi setiap temuan; jangan menerapkan seluruh perbaikannya secara membabi buta. Satu contoh PP10 yang cocok belum membuktikan seluruh PP3 dan kondisi batas benar.

Kerjakan pada branch terpisah. Serahkan perubahan, hasil tes yang benar-benar dijalankan, risiko tersisa, serta prosedur rollback. Jangan melakukan migrasi atau deployment produksi dalam penugasan ini.
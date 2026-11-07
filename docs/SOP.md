# SOP kerja dan peluncuran produksi

Laptop untuk pengembangan, GitHub untuk versi/review, salinan sementara untuk tes, VPS untuk rilis. Satu backend fork saja karena state disimpan dalam cache proses. Snapshot SQLite mencakup WAL dan BLOB; menyalin file utama yang sedang terbuka tidak menjadi metode backup.

## Aturan akun yang sudah disepakati

Pertahankan Super Admin utama, CEO (super_admin/all_bank), Agung Pambudi dengan role dan cakupan saat ini, serta seluruh admin_ops dan admin_branch yang ada. Cocokkan dengan email/ID tepat; jangan menebak dari nama. Status aktif/nonaktif akun terlindungi dipertahankan. Daftar akun di luar kelompok ini ditampilkan dalam rencana untuk dinonaktifkan. Jika Agung ber-role Marketing dengan manager di luar daftar, tentukan dependensinya dalam rencana dahulu.

## Tahapan sebelum Senin 9 November

1. **Catat kondisi aktual.** Baca cwd proses PM2 dan versi rilis; verifikasi backend hanya 127.0.0.1:4000, Nginx/TLS, timer Certbot, startup PM2 dan kapasitas. Tentukan PIC teknis/operasional serta waktu maintenance.
2. **Arsipkan UAT.** Buat snapshot SQLite konsisten sebagai lpapp dan lindungi hasilnya. Simpan salinan terenkripsi di laptop pemilik sesuai keputusan awal. Uji pemulihan dari file yang sudah ada di laptop ke folder/mesin terpisah: data, login dan byte dokumen harus cocok. Kata sandi backup disimpan terpisah.
3. **Siapkan rencana dari snapshot.** Jalankan inventory, cocokkan policy privat, lalu buat plan. Periksa daftar akun, role CEO, role/cakupan Agung, semua admin, calon akun nonaktif, serta seluruh ID data yang akan dikosongkan. Pastikan data tersebut benar-benar UAT; data nyata yang sudah masuk membutuhkan rencana pemisahan tersendiri.
4. **Buat calon produksi di folder baru.** Siapkan database kandidat yang mempertahankan master/parameter bank dan akun, mengosongkan koleksi bisnis UAT serta BLOB di salinan saja. Password sementara acak dihasilkan untuk akun yang aktif dan wajib diganti saat pertama masuk. File kredensial privat dibagikan oleh pemilik melalui kanal aman, tidak ke Git/chat/screenshot.
5. **Uji kandidat.** Startup produksi dan restart kedua tidak boleh menambahkan data demo. Periksa semua akun/cabang/bank, alur dokumen, PP3/PP10/PENSIUN dengan acuan yang disetujui klien, serta persetujuan/pembayaran klaim. Jalankan `python3 ops/ci.py` di checkout pengembangan; jangan menunjuk suite API ke VPS.
6. **Review hasil konkret.** Catat commit, checksum paket/kandidat, checksum plan, roster, jumlah data/master, lokasi arsip dan hasil uji. Persetujuan aktivasi/pembersihan mengacu hasil ini; menyusun kandidat tidak mengubah live DB.
7. **Maintenance/cutover terkontrol.** Hentikan input pengguna, aktifkan 503 pada location aplikasi sambil mempertahankan challenge ACME. Hentikan satu proses aplikasi, buat backup akhir dan cocokkan fingerprint terhadap snapshot rencana. Jika berubah, hentikan pergantian dan tinjau perubahan. Pasang kode/config/database kandidat sebagai pasangan; pindahkan seluruh direktori data lama beserta WAL/SHM ke arsip terlindungi. Jangan mencampur sidecar lama dengan database baru.
8. **Verifikasi sebelum membuka trafik.** Satu proses lpapp, HOST127.0.0.1/PORT4000, HTML rilis benar, API anonim401, database/master/akun cocok. Simpan PM2 dan buktikan startup/reboot pada jendela yang disepakati. Verifikasi HTTPS dan backup terjadwal. Setelah dibuka, masing-masing pemilik akun mengganti password sementara.

Target Sabtu: perbaikan dan rencana. Minggu: pengujian/pemulihan/penerimaan dan pembekuan versi. Senin sebelum operasional: pemeriksaan akhir serta pendampingan. Penggunaan data nyata menunggu seluruh syarat wajib lulus.

Checklist untuk pemilik/PIC ada di [CHECKLIST-PEMILIK.md](CHECKLIST-PEMILIK.md); perintah inventory pertama ada di [MULAI-DI-SINI.md](MULAI-DI-SINI.md). Perintah teknis backup/enkripsi/kandidat ada di [RUNBOOK.md](RUNBOOK.md). Catat hanya tes yang benar-benar dijalankan; hasil cloud/CI tidak menggantikan pemeriksaan server.

## Kerja rutin setelah peluncuran

- Satu tugas pada branch pendek dari baseline produksi, perubahan kecil, tes relevan dan review. Rilis menunjuk commit yang sudah diuji; jangan mengedit kode live atau git pull di direktori proses.
- Backup otomatis per jam dan sebelum setiap perubahan; salinan terenkripsi di luar VPS mengikuti jadwal yang disepakati. Pantau umur backup, disk, proses dan masa berlaku TLS.
- Admin membuka berkas terbaru sebelum menerima. Unggah ulang membentuk versi baru dan memerlukan pemeriksaan ulang. Berkas yang hilang ditangani sebagai masalah dokumen, bukan diganti dengan PDF contoh.
- Persetujuan klaim menghasilkan APPROVED. PAID hanya setelah transfer aktual, unggah bukti valid dan nominal sesuai persetujuan.
- Pemulihan password dibantu administrator setelah verifikasi identitas. Kata sandi sementara unik dan sesi lama dicabut. CEO mempunyai hak Super Admin sesuai keputusan pemilik.
- Catat setiap insiden tanpa password/token/isi dokumen. Setelah data produksi masuk, pengembalian snapshot yang menghilangkan input memerlukan penilaian rekonsiliasi dan keputusan pemilik. Pemulihan kode saja ke versi01fa73b tidak kompatibel dengan kontrak data baru.

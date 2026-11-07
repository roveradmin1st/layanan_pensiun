# Perubahan persiapan operasional 9 November 2026

Basis bisnis: `01fa73b8fa4d433ab62cd15b3609fb46968c7155` pada branch `fix/bsi-product-parameters`. Branch usulan: `fix/production-readiness-20261109`. Perubahan ini belum dipasang ke VPS.

- Produksi berhenti dengan error bila DB/state hilang atau tidak valid, tanpa mengisi kembali demo. Startup produksi mempertahankan parameter yang sudah dimigrasikan.
- Password baru memakai scrypt dengan salt acak dan antrean terbatas. Login sah memigrasikan hash legacy; password contoh ditolak pada produksi. Reset/change/role-scope change/logout mencabut token lama; pengguna baru/reset wajib mengganti password sementara.
- Pembatasan login dan ukuran request; Multer2.5.0, batas bagian unggahan dan penanganan unggahan terputus. Backend produksi/PM2 default hanya127.0.0.1.
- Dokumen pengajuan punya file ID per versi, hash, byte versi sebelumnya, dan persetujuan yang terikat versi/hash. Tanpa berkas asli, persetujuan/forward ditolak. Produksi tidak menghasilkan PDF contoh untuk berkas yang hilang.
- Persetujuan klaim menjadi APPROVED. PAID membutuhkan pembayaran terpisah dengan bukti dan nominal yang sesuai. Persetujuan bukan bukti transfer otomatis.
- Frontend menyediakan gerbang ganti password pertama; panel simulasi hanya build development; fitur restore produksi diblokir di server dan dinonaktifkan di UI. Lupa kata sandi mengarahkan ke bantuan administrator, tanpa klaim pengiriman email yang belum tersedia.
- Alat offline menyiapkan plan dan calon produksi dari arsip. Seluruh admin dan akun terpilih dipertahankan sesuai keputusan pemilik. Tidak ada perintah apply/clean live pada alat tersebut.
- Konfirmasi inventory: reaktivasi Agung didukung melalui selector tepat dalam policy/plan, dengan role Sales Manager tetap. Reaktivasi tanpa pencantuman eksplisit atau untuk akun di luar daftar terlindungi ditolak; admin nonaktif lain tetap nonaktif.
- Konfirmasi wilayah: alias PEMATNGSIANTAR/BSI SIANTAR 2 dikenali sebagai PEMATANGSIANTAR pada otorisasi, API profil dan pilihan SM. Role/bank_scope tetap; kandidat dan password yang sudah disiapkan tidak diubah.
- Pemeriksaan kandidat memakai salinan fisik terpisah, semua login aktif, gerbang password, restart produksi kedua dan verifikasi checksum kandidat/kredensial asli. Pemeriksaan terintegrasi CI memakai data sintetis saja.
- Alat operasi terpisah memeriksa rilis yang belum aktif sebagai UID/GID lpapp dengan data sementara dan dua startup. Checksum/izin kode, identitas proses, loopback, HTML/API dan kebersihan data diperiksa. Kegagalan setelah startup tetap membersihkan proses/link/data uji; kode aplikasi tetap dipin ke c76e823 selama publikasi alat ini.
- Backup SQLite konsisten sebagai lpapp, penyegelan root, timer, doctor tanpa dump secret dan ekspor GPG terenkripsi ke laptop. SOP memisahkan arsip, kandidat, review dan aktivasi.
- CI tanpa izin deploy, database tes terpisah, tes startup/sesi/dokumen/pembayaran dan browser pada data sintetis. Tes parameter lama kini memakai DB sendiri sehingga tidak mengubah kebijakan tes berikutnya.

Kompatibilitas: hash scrypt dan file dokumen per versi memerlukan kode baru. Rollback kode saja ke01fa73b tidak didukung. Sebelum trafik dibuka gunakan pasangan kode/data/config yang cocok; setelah input nyata, pemulihan memerlukan penilaian rekonsiliasi. Arsip UAT tidak dihapus oleh patch ini.

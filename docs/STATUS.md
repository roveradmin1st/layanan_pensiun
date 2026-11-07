# Kesiapan operasional 9 November 2026

Baseline patch: `01fa73b8fa4d433ab62cd15b3609fb46968c7155`, branch tugas `fix/production-readiness-20261109`. VPS `01fa73b` dilaporkan aktif oleh pengguna. Workspace AI tidak memiliki SSH langsung ke VPS.

Pemilik mengizinkan pelaksanaan perbaikan produksi dan SOP pada 7 November 2026 WIB. Pertahankan akun Super Admin utama, CEO dengan role super_admin dan seluruh bank, Agung Pambudi dengan role/cakupan yang sama, serta semua admin_ops/admin_branch. Daftar tersebut bukan batas lima akun. Selector email yang dikonfirmasi pemilik disimpan dalam policy privat, bukan source Git. Akun lain diusulkan nonaktif, bukan dihapus. Status aktif/nonaktif akun terlindungi tetap dipertahankan kecuali reaktivasi yang disetujui secara eksplisit. Konfirmasi terbaru pemilik: koreksi selector Agung berdasarkan inventory aktual, pertahankan role Sales Manager dan aktifkan kembali saat cutover; belum diubah pada VPS.

Alur klaim yang disetujui pemilik: persetujuan dahulu, pembayaran kemudian dengan bukti transfer. Peluncuran 9 November memakai data nyata. Arsip UAT harus lengkap sebelum rencana pembersihan dijalankan.

## Perubahan yang disiapkan di branch lokal

- Produksi tidak membuat database/data demo dan tidak mengganti state rusak dengan seed; pembaruan fixture hanya untuk development.
- Password scrypt dengan salt acak; migrasi hash lama setelah login sah; pembatasan login, revokasi token lama dan perubahan password saat pertama masuk.
- Berkas versi baru disimpan terpisah; penerimaan terikat versi/hash dan berkas asli. Perubahan berkas menggugurkan persetujuan sebelumnya.
- Klaim APPROVED terpisah dari PAID. Bukti pembayaran asli diperlukan dan nominal harus sesuai persetujuan.
- `ops/production.py` membuat inventory, rencana dan database calon produksi dari snapshot offline. Tidak ada perintah yang memasang atau membersihkan live DB.
- Backup SQLite terjadwal, pemeriksaan server, SOP dan CI pada data sementara.

## Bukti dan batas verifikasi — 7 November 2026

- 17 tes Python lulus: 11 untuk persiapan calon produksi dan 6 untuk backup/doctor/ekspor. Termasuk reaktivasi eksplisit akun terlindungi tanpa mengubah role/cabang/bank, penolakan reaktivasi akun di luar daftar, dan pelestarian admin nonaktif lainnya. Terbukti pelestarian seluruh admin, role Agung/CEO, data/master, penolakan plan stale/tamper/typo, dependensi manager, path live dan file privat. Format scrypt Python diverifikasi dengan verifier Node. Kandidat Python berhasil dibuka dua kali oleh Node dalam mode produksi tanpa mengembalikan data demo. Backup mencakup transaksi WAL yang committed dan byte dokumen persis.
- 51 tes backend lulus, termasuk penolakan DB produksi hilang/rusak tanpa seed, restart tidak memunculkan demo, scrypt, pembatasan login, revokasi sesi, gerbang ganti password, berkas asli/versi/hash dan pembayaran klaim dengan bukti. Suite API keamanan/RBAC/regresi bisnis dan smoke produksi juga lulus.
- Build frontend serta 4 alur Chromium 155 lulus menggunakan data sintetis: login produksi tanpa akun contoh, ganti password pertama, Pengaturan dengan restore nonaktif, penerimaan satu dokumen, serta APPROVED kemudian PAID dengan bukti. Screenshot/result tersedia pada `artifacts/browser/` lokal dan tidak masuk Git.
- Perintah lengkap yang dijalankan: `python3 ops/ci.py --browser --system-chromium`, dengan npm ci dari lockfile, di cloud Node 24.22.1/Python 3.12. Validasi akhir setelah tambahan guard input akun/integrasi kandidat memakai flag `--skip-install` dengan dependensi yang sama. Pin rilis/VPS adalah Node 24.22.2; workflow menggunakan pin tersebut dan belum dijalankan di GitHub karena branch belum dipublikasikan.
- Validasi actionlint, parser unit systemd dan jadwal timer Asia/Jakarta lulus. Uji GPG AES256 enkripsi/dekripsi dengan checksum identik lulus pada byte sintetis. Ini bukan bukti instalasi/root scheduler, GPG di VPS, pengunduhan laptop atau restore data live.
- `npm audit --omit=dev`: backend 0 advisory, frontend 2 moderate pada react-router/react-router-dom (advisory redirect dan SSR hydration). Aplikasi memakai SPA BrowserRouter, bukan SSR hydration; penggunaan Link/navigate yang diperiksa menunjuk path internal. Temuan tetap dicatat, belum dianggap tertutup. Perbaikan yang ditawarkan npm melibatkan major v7; tidak dijalankan `audit fix --force`. Jadwalkan upgrade teruji setelah patch ini ditinjau. Build/dev dependency tidak termasuk angka audit produksi tersebut; Vite devserver tidak boleh dipasang sebagai server produksi.
- Tidak ada data VPS yang dibersihkan, tidak ada password live yang diganti dan belum ada patch ini dipasang pada VPS.
- Pemulihan dari patch ini ke01fa73b tidak cukup dengan mengganti kode: hash password, identitas berkas dan kontrak persetujuan berubah. Sebelum membuka trafik, rollback menggunakan pasangan kode/database/config yang cocok; setelah ada input nyata, utamakan perbaikan maju atau rekonsiliasi yang disetujui.
- Cabang default main sebelumnya tertinggal dari baseline bisnis; jangan deploy main lama atau force-push. Otomasi privileged draft enterprise-state-v1 dari pekerjaan sebelumnya belum dipasang dan tidak digunakan di branch ini.

Inventory VPS sudah diterima: 27 akun (2 Super Admin termasuk CEO, 3 Admin Operasional, 5 Admin Cabang, 8 Sales Manager, 9 Marketing), 32 leads, 2 permintaan leads, 9 pengajuan, 14 simulasi, 5 klaim, 51 dokumen. Roster aktual dan policy tetap privat di luar Git. Dengan konfirmasi Agung, rencana awal mempertahankan 11 akun dan mengusulkan 16 lainnya nonaktif. CEO sudah super_admin/all_bank. Lokasi current/proses aktif belum dibuktikan oleh output inventory yang diterima.

Backup manual VPS sudah dilaporkan berhasil dan metadata menunjukkan integrity ok, jumlah data sesuai inventory dan 51 dokumen. GPG VPS versi2.4.4 tersedia. Pengguna sudah mengunduh arsip terenkripsi beserta checksum ke laptop; screenshot PowerShell menunjukkan CHECKSUM COCOK. Ini membuktikan integritas unduhan terhadap manifest, belum merupakan bukti pemulihan file dari laptop.

Langkah berikutnya: buat folder uji privat baru pada home operator, unggah kembali kedua file dari laptop, dekripsi ke file sementara baru sebagai operator, lalu cocokkan SHA256 database dengan catatan backup awal dan jalankan integrity_check/jumlah melalui koneksi SQLite baca-saja. Panduan chat/helper berada di workspace `/workspace/server-prep/restore-from-laptop.sh`; kode pemeriksa diuji pada SQLite sintetis, penolakan checksum salah dan file rusak. Hasil uji nyata masih menunggu pengguna. Tidak ada reset/restore ke shared/data, perubahan akun atau aktivasi patch. Setelah uji ini, review roster/plan/candidate, hasil doctor/reboot dan persetujuan acuan bank sebelum maintenance/cutover.

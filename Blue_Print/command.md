# Pemeriksaan ulang branch setelah push

Tanggal: 4 November 2026 WIB. Branch: `fix/security-and-operational-integrity`.

Commit remote yang diuji: **`f262fa5cba5a2df9f18b522ded4adf5054193225`**.
Commit audit sebelumnya: `05a62a547f82546f99e898e1539e13f4c4c3122c`.
`main` tetap `52ac0b883d903bca2dd35c3dd3ca43a8243d662f`. Hash kedua branch diperiksa ulang setelah tes. Checkout kerja awal tetap bersih; tidak ada perubahan source, merge, push, atau deployment.

**Keputusan: pembaruan pengaturan/RBAC sudah terverifikasi, tetapi penghalang rilis utama sebelumnya masih dapat direproduksi. Kandidat belum lulus gate penggunaan operasional.**

## Perbaikan yang sudah masuk dan lulus

Commit terbaru mengubah delapan file, terutama pengaturan akun dan pembatasan parameter bank.

- `GET /api/calc/params`: Super Admin dan Admin Ops mendapat 200; Marketing, Sales Manager, dan Admin Cabang mendapat 403.
- Marketing ditolak mengubah parameter bank melalui PUT.
- Dashboard Marketing tidak mengirim field omzet kotor dan laba bersih perusahaan yang diuji.
- Halaman pengaturan memisahkan profil pribadi dan parameter admin pusat; kalkulator tidak lagi meminta parameter lengkap untuk role non-pusat.
- `npm test`: **19 lulus, 0 gagal, 0 skipped**.
- `npm run build`: **lulus**, 2.598 modul, selesai 4,40 detik pada mesin audit.
- Suite HTTP keamanan asli termasuk kasus pembatasan pengaturan baru: **lulus dengan fixture BSI**. Pada seed bersih, suite masih gagal di baris 228 karena aplikasi BSI yang diharapkan tidak tersedia. Fixture dibuat melalui API pada database audit; kode tes tidak diubah.

Bukti: [tes backend](/workspace/audit-2026-11-04/recheck-f262fa5/test.log), [build](/workspace/audit-2026-11-04/recheck-f262fa5/build.log), [suite dengan fixture](/workspace/audit-2026-11-04/recheck-f262fa5/security-with-fixture.log), [suite pada seed bersih](/workspace/audit-2026-11-04/recheck-f262fa5/security-fresh.log).

## Temuan yang masih harus ditutup

| Prioritas | Temuan dan bukti pengujian ulang | Perbaikan yang diperlukan |
|---|---|---|
| **P0** | Fallback JWT di konfigurasi PM2 masih ada. Server production audit menerima token yang ditandatangani dengan nilai fallback dari repo, menghasilkan HTTP 200 sebagai `super_admin`. [Konfigurasi](/workspace/audit-2026-11-04/recheck-f262fa5/ecosystem.config.cjs:16), [hasil](/workspace/audit-2026-11-04/recheck-f262fa5/default-key-result.json). | Hapus fallback produksi pada PM2/Compose; injeksikan kunci acak unik. Tolak kunci kosong/nilai contoh. Uji sesi yang dibuat menggunakan nilai contoh harus 401. |
| **P1** | Admin `bsi_only` masih bisa PATCH password marketing `all_bank` di cabang yang sama: PATCH 200, login memakai password baru 200, dan akses AMS2 tersedia. [Handler](/workspace/audit-2026-11-04/recheck-f262fa5/backend/src/server.js:2121), [hasil](/workspace/audit-2026-11-04/recheck-f262fa5/bank-scope-user-result.json). | Kebijakan pengelolaan user harus memeriksa scope target selain role/cabang. Cakup list/read/reset/deaktivasi. Reset lintas scope wajib 403 dan password target tidak berubah. |
| **P1** | HTML inert masih diterima dan dilayani `Content-Type: text/html`, `Content-Disposition: inline`, tanpa CSP sandbox. Tidak ada skrip berbahaya yang dijalankan dalam audit. [Upload](/workspace/audit-2026-11-04/recheck-f262fa5/backend/src/server.js:1323), [hasil](/workspace/audit-2026-11-04/recheck-f262fa5/upload-type-result.json). | Tolak format aktif dan periksa signature isi file; jangan mengandalkan MIME/ekstensi klien. Sajikan dokumen secara aman dan uji PDF/JPG/PNG yang diizinkan. |
| **P1 — regresi dari perubahan baru** | Role Marketing kini tidak menerima `partnerParams`, sedangkan rekomendasi live memakai fallback lokal. Saat Super Admin mengubah maksimum tenor AMS2 menjadi 60 bulan pada database audit, helper rekomendasi Marketing menghasilkan **120 bulan**, sementara API kalkulator menghasilkan **60 bulan**. [Pengambilan parameter](/workspace/audit-2026-11-04/recheck-f262fa5/frontend/src/pages/Calculator.jsx:1022), [fallback helper](/workspace/audit-2026-11-04/recheck-f262fa5/frontend/src/pages/Calculator.jsx:745), [hasil](/workspace/audit-2026-11-04/recheck-f262fa5/live-recommendation-result.json). | Gunakan hasil rekomendasi dari server atau endpoint terbatas yang hanya mengembalikan batas/hasil yang dibutuhkan. Pertahankan proteksi parameter admin. Uji perubahan konfigurasi muncul konsisten pada Admin dan Marketing. Bukti ini menjalankan helper frontend asli di Node VM dan membandingkannya dengan API; interaksi browser belum diuji. |

## Kekurangan lama yang masih terkonfirmasi

- Probe production tambahan: **14 kasus; 10 lulus dan 4 gagal**. Kasus gagal: forgot-password 404, reset-password 404, backup JSON tidak berisi bytes dokumen, dan bukti pembayaran yang belum ada tetap dibalas PDF pengganti 200. [Hasil](/workspace/audit-2026-11-04/recheck-f262fa5/production-probe-results.json).
- Akun seed/upgrade otomatis, hash password statis, dan fallback reseed pada kegagalan state belum berubah dari audit sebelumnya. Tidak diuji ulang secara terpisah pada task ini; temuan berdasarkan perbandingan source dengan commit sebelumnya.
- Suite keamanan masih di luar `npm test`. Lulusnya suite tersebut belum mencakup celah reset user lintas scope, HTML inline, atau konfigurasi fallback JWT.

## Langkah cepat pasti

1. Tutup P0 dan tiga temuan P1 pada tabel, lalu tambahkan regression case yang mereproduksi masing-masing.
2. Jalankan kembali build, 19 tes, suite keamanan dengan fixture mandiri, serta probe production pada SHA final.
3. Gunakan runbook migrasi sebelumnya: satu proses backend, Node 24, reverse proxy HTTPS, akses penguji terbatas, data UAT sintetis, JWT unik, akun penguji unik, dan backup SQLite penuh.
4. Jalankan checklist admin pada 5 November 2026 WIB. Pengujian VPS, DNS/TLS, browser/PWA, kapasitas, serta data aktual tetap belum dilakukan.

[Runbook migrasi](/workspace/reports/RENCANA-MIGRASI-UAT-2026-11-04.md) dan [26 kasus UAT admin](/workspace/reports/CHECKLIST-UAT-ADMIN-2026-11-05.csv) tetap berlaku dengan status hasil pemeriksaan ulang ini.

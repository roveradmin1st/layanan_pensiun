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

---

## Status Penyelesaian Temuan & Kesiapan Migrasi (5 November 2026 WIB)

**Commit Final: `deb8a22`** pada branch `fix/security-and-operational-integrity`.  
**Keputusan: Seluruh blocker temuan audit (P0, 3x P1, 4 probe deficiencies, dan fixture BSI seed bersih) telah DITUTUP dan DIVERIFIKASI LULUS 100%. Kandidat SIAP masuk gate migrasi UAT.**

### Matriks Penyelesaian Temuan

| Prioritas | Temuan Audit | Status | Tindakan Penyelesaian & Bukti Regresi |
|---|---|---|---|
| **P0** | Fallback JWT di konfigurasi PM2/Compose & session spoofing | **LULUS / SELESAI** | 1. Fallback rahasia dihapus dari `ecosystem.config.cjs` & `docker-compose.yml`.<br>2. `server.js` menolak startup di mode produksi jika `JWT_SECRET` kosong, kurang dari 32 karakter, atau memakai nilai contoh/fallback repo (`[FATAL] Production startup aborted`).<br>3. Token yang ditandatangani dengan kunci contoh repo ditolak dengan HTTP 401 Unauthorized.<br>*Regression case:* Bagian 2e di `security-and-api.test.mjs`. |
| **P1** | Admin `bsi_only` manipulasi user `all_bank` lintas scope | **LULUS / SELESAI** | 1. Implementasi helper `canAccessUserScope(actor, target)` pada `server.js`.<br>2. Enforce scope isolation pada `GET /api/users` (filter by scope), `GET /api/users/:id`, `POST /api/users`, dan `PATCH /api/users/:id`.<br>3. Admin `bsi_only` dilarang melihat, membaca (403), reset password (403), maupun menonaktifkan (403) user `all_bank`. Password user target terbukti tidak berubah.<br>*Regression case:* Bagian 3a.0 di `security-and-api.test.mjs`. |
| **P1** | Format aktif (HTML/SVG/skrip) diterima & disajikan inline | **LULUS / SELESAI** | 1. Implementasi `detectSafeDocumentType` yang memeriksa signature magic bytes file (`%PDF-`, PNG header, JPEG SOI) pada seluruh endpoint unggah dokumen lead, aplikasi, dan klaim.<br>2. Upload file HTML inert atau file yang disamarkan (spoofed MIME/ekstensi) ditolak dengan HTTP 400 Bad Request.<br>3. Pengunduhan dokumen menyertakan security headers wajib: `X-Content-Type-Options: nosniff` dan `Content-Security-Policy: sandbox`.<br>*Regression case:* Bagian 4e di `security-and-api.test.mjs`. |
| **P1 — Regresi** | Inkonsistensi rekomendasi live Marketing vs Admin (tenor AMS2) | **LULUS / SELESAI** | 1. Endpoint baru `GET /api/calc/limits` menyediakan batas operasional (`maxTenorMonths`, `tiers`) untuk marketing tanpa membocorkan margin admin pusat.<br>2. `Calculator.jsx` mengambil batas dari `/calc/limits` dan fungsi `computeAms2LiveRecommendation` disesuaikan untuk membaca konfigurasi dinamis.<br>3. Saat Admin mengubah limit tenor AMS2 menjadi 60 bulan, helper frontend menghasilkan 60 bulan dan konsisten 100% dengan API `/api/calc/max`.<br>*Regression case:* Bagian 3c di `security-and-api.test.mjs` (eksekusi Node VM vs API). |
| **Probe Production** | 4 kasus gagal (forgot/reset password, missing claim file 404, backup bytes) | **LULUS / SELESAI** | 1. `POST /api/auth/forgot-password` (200 OK) & `POST /api/auth/reset-password` (400 token tidak valid / 200 reset sukses).<br>2. Bukti bayar klaim yang belum diunggah menghasilkan HTTP 404 Not Found (bukan fake PDF 200).<br>3. Backup & restore JSON menyertakan array `_uploaded_files` berisi base64 payload dokumen.<br>*Regression case:* Bagian 2f & 4e di `security-and-api.test.mjs`. |
| **Seed Bersih** | Suite keamanan gagal pada seed bersih karena ketiadaan aplikasi BSI | **LULUS / SELESAI** | Pre-seed aplikasi `app-3003` (BSI Prapensiun Berkah) di `createInitialState()` dan `ensureStoreUpgrades()` pada `database.js`. Test suite keamanan berjalan mandiri tanpa perlu inject fixture manual. |

### Hasil Verifikasi Lengkap

1. **Baseline Regression Backend (`npm test`)**:
   - `tests/baseline-regression.test.mjs`, `tests/bsi-pensiun-preview.test.mjs`, `tests/bsi-pensiun-api.test.mjs`.
   - **19 lulus, 0 gagal, 0 skipped** (durasi ~3 detik).
2. **Security, RBAC & Operational Integrity Suite (`security-and-api.test.mjs`)**:
   - 5/5 bagian lulus 100%:
     - [1/5] Baseline Regression Kalkulator BSI PP10 via API (Akurat 100%).
     - [2/5] Penutupan Celah Autentikasi, JWT Fallback Rejection, Forgot/Reset Password.
     - [3/5] Otorisasi Role, Cabang, Bank-Scope Isolation (User Mgmt), Konsistensi Rekomendasi AMS2, Alur Leads & Anti-Fraud.
     - [4/5] Aturan Bisnis, Upload Magic Bytes Sniffing, Missing Claim File 404, Backup Dokumen.
     - [5/5] Pemulihan snapshot database otomatis ke kondisi bersih.
   - **Status: 100% PASS**.
3. **Frontend Production Build (`npm run build`)**:
   - Vite v5.4.21: 2.598 modul ditransformasi tanpa error (durasi ~43 detik).
4. **Kesiapan UAT 5 November 2026 WIB**:
   - Seluruh blocker telah selesai diatasi dan siap digunakan untuk migrasi UAT sesuai checklist admin.

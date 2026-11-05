# Audit persetujuan dokumen pengajuan — 5 November 2026 WIB

Permintaan: memvalidasi kegagalan persetujuan dokumen satu per satu oleh Super Admin/Admin Operasional, kelolosan pengajuan tanpa pemeriksaan berkas yang benar, serta kesesuaian kode migrasi dengan GitHub. Ruang lingkup pekerjaan ini adalah audit; tidak ada perubahan kode aplikasi, push, deployment, atau perubahan database pengguna.

**Kesimpulan:** ditemukan dua bug utama pada commit `c693d42422dae82b033a74e632d5f0911540427c`: kontrak status persetujuan frontend/backend berbeda, dan tahap pengajuan tidak memeriksa kelayakan dokumen. Keduanya direproduksi lewat HTTP pada salinan commit yang bersih dengan database sintetis, `NODE_ENV=production`, JWT acak, dan listener loopback. Pengujian tidak menggunakan VPS atau database klien.

## 1. Pemeriksaan GitHub dan batas verifikasi VPS

Hasil `git ls-remote --heads origin` serta fetch saat audit:

| Branch | SHA |
|---|---|
| `fix/security-and-operational-integrity` | `c693d42422dae82b033a74e632d5f0911540427c` |
| `main` | `52ac0b883d903bca2dd35c3dd3ca43a8243d662f` |

Tidak ada commit yang lebih baru pada kedua branch tersebut saat diperiksa. Kandidat yang dipasang melalui panduan migrasi adalah `c693d42`, sehingga bug ini memang ada pada kode yang sudah di-push dan menjadi dasar deployment.

**Pembaruan verifikasi VPS:** pengguna sudah memberikan hasil pembacaan cwd proses dan checksum. Proses berjalan dari `/srv/layanan-pensiunan/releases/layanan-pensiunan-c693d42-uat/backend`. Keempat checksum (`server.js`, `database.js`, `dist/index.html`, dan bundle `Progress-D0fDWUrm.js`) cocok dengan acuan. Dengan demikian file runtime yang terkait temuan ini sesuai dengan kandidat yang diaudit. Bukti berasal dari output yang diberikan pengguna; agent tidak mengakses VPS secara langsung. Pemeriksaan empat file ini tidak mengklaim seluruh filesystem/configuration/database telah diverifikasi.

Backend dan frontend sumber dalam arsip audit berasal dari SHA yang sama. Checkout asli `/workspace/layanan_pensiun` tetap bersih dan tidak dipindahkan dari `main`.

## 2. P1 — Tombol Terima per berkas selalu ditolak backend

- `frontend/src/pages/Progress.jsx:175` menjalankan `review(d.key, "diterima")`.
- Fungsi di `:114–117` mengirim nilai tersebut ke `POST /api/applications/:id/documents/:key/review`.
- `backend/src/server.js:2132` memang mengizinkan `super_admin`, `admin_ops`, dan `admin_branch`.
- Namun whitelist pada `:2143` hanya mengizinkan `lengkap`, `ditolak`, dan `diunggah`.
- Hasil untuk Super Admin maupun Admin Operasional: **HTTP400, `Status verifikasi dokumen tidak valid.`** Status berkas tetap `diunggah`.

Kontrol uji dengan status `lengkap` menghasilkan200, tetapi bukan solusi operasional: UI menghitung dan menampilkan status diterima berdasarkan `diterima`, bukan `lengkap`. Seed/checklist juga memakai `diterima`. Mengubah tombol menjadi `lengkap` saja akan membuat status dan indikator kelengkapan tidak konsisten.

Riwayat Git menunjukkan whitelist yang tidak selaras ditambahkan pada commit `60a44b447526b66ed1d33793d6484ae0110a55de`, 1 November 2026. Frontend sudah mengirim `diterima` sebelumnya. Ini regresi kode, bukan bukti pembatasan role Super Admin atau konfigurasi Nginx.

## 3. P1 — Pengajuan dapat maju walaupun dokumen kosong, belum diperiksa, atau ditolak

`frontend/src/pages/Progress.jsx:203–205` menampilkan Ajukan/Teruskan berdasarkan tahap dan pihak yang menunggu. Kondisi tombol tidak memeriksa bahwa seluruh berkas wajib sudah diterima. `backend/src/server.js:2228–2241` kemudian menjalankan submit/forward tanpa validasi checklist.

Reproduksi lewat alur yang juga tersedia pada UI:

1. Buat lead dan simulasi sintetis yang layak, lalu buat pengajuan baru.
2. Upload satu PDF pada checklist pengajuan.
3. Tolak berkas tersebut dengan alasan ketidaksesuaian identitas; API berhasil200.
4. Marketing mengajukan kembali; API submit berhasil200 meskipun satu berkas masih ditolak dan tujuh belum diunggah.
5. Super Admin atau Admin Operasional meneruskan pengajuan; API forward berhasil200 dan stage menjadi `verifikasi_bank`.
6. Dokumen tetap berstatus `ditolak`; tujuh lainnya tetap kosong. Pengajuan maju tanpa menjadikan semua berkas diterima.

Kasus tambahan yang terbukti:

- **0/8 dokumen diunggah:** submit200 dan forward200.
- **8/8 diunggah, 0 diterima:** forward200 tanpa review individual.
- Pemanggilan `advance` langsung dari fase upload juga berhasil200, menuju `pengajuan_bank` tanpa berkas.

Jadi yang terlihat sebagai “approve sekaligus” sebenarnya perpindahan tahap pengajuan yang **melewati validasi dokumen**. Setelah berpindah dari `upload_dokumen`, UI menyembunyikan tombol review individual (`Progress.jsx:173`), sehingga pengguna makin sulit melanjutkan pemeriksaan per berkas.

Penolakan individual sendiri sudah ada dan mewajibkan catatan: tanpa alasan400, dengan alasan200. Yang tidak berjalan adalah persetujuan individual dan penguncian tahap berikutnya ketika berkas belum memenuhi syarat.

## 4. Temuan terkait yang perlu masuk desain perbaikan

**Berkas harus benar-benar ada.** Review API menerima `lengkap` bahkan pada item dengan `filename=null` dan tanpa unggahan. Endpoint unduh pengajuan (`server.js:2122`) juga mengembalikan PDF simulasi pengganti ketika BLOB dokumen tidak ada; kontrol uji pada pengajuan baru menghasilkan200. Keberhasilan unduh200 tidak selalu berarti berkas persyaratan yang sesungguhnya tersedia.

**Dokumen lead dan dokumen pengajuan adalah dua tempat berbeda.** `LeadDetailSheet.jsx:19–60` menyediakan upload/buka/hapus, tanpa review dokumen. Metadata lead disimpan dalam `lead.documents`; pengajuan baru membuat delapan checklist kosong (`server.js:1166–1173`). Satu dokumen yang diunggah di lead menghasilkan0 dokumen pada checklist pengajuan baru. Jika dokumen lead ingin dipakai kembali, perlu aturan pemetaan dan pilihan berkas yang jelas, tanpa otomatis menganggapnya sudah disetujui.

**Indikator UI mencampur unggah dan persetujuan.** `Progress.jsx:119` menghitung `diunggah` dan `diterima` bersama. Angka8/8 berarti semua berkas diunggah/tersedia menurut status, bukan delapan berkas sudah diverifikasi. Perlu dua indikator: jumlah diunggah dan jumlah diterima.

**Tampilan role perlu diselaraskan.** `isAdmin` mencakup Sales Manager sehingga UI bisa menampilkan tombol review, sementara API menolak403. Ini temuan terpisah dari kegagalan dua role yang dilaporkan pengguna; jangan memperluas hak akses Sales Manager hanya untuk menghilangkan error.

## 5. Bukti pengujian

| Skenario | Hasil aktual |
|---|---|
| Super Admin menerima PDF dengan payload dari UI | 400, status tetap `diunggah` |
| Admin Operasional menerima PDF dengan payload dari UI | 400, status tetap `diunggah` |
| Kedua role menolak tanpa alasan | 400 |
| Kedua role menolak dengan alasan | 200, status `ditolak` |
| Satu dokumen ditolak + tujuh kosong, lalu submit/forward | 200 untuk kedua role, stage `verifikasi_bank` |
| Delapan diunggah, tidak ada review diterima, lalu forward | 200 |
| Seluruh dokumen kosong, lalu submit/forward | 200 |
| `advance` dipanggil langsung saat upload | 200 |
| Marketing/Sales Manager mencoba review | 403 |
| `lengkap` untuk item tanpa file | 200, filename tetap null |

Script utama menyelesaikan12 kasus bukti dengan exit0: assertion-nya membuktikan perilaku saat ini, **bukan menyatakan aplikasi sudah lulus kebutuhan bisnis**. Kontrol tambahan membuktikan penerimaan item tanpa file dan PDF pengganti. Tidak ada tes destruktif dijalankan pada aplikasi live.

Suite keamanan lama tidak mencakup route review dokumen. Pada `backend/tests/security-and-api.test.mjs:650–699`, pengajuan langsung diteruskan/dimajukan tanpa menyiapkan delapan berkas dan review yang valid. Ini menjelaskan mengapa suite sebelumnya lulus, tetapi bug approval tidak tertangkap. Fixture dan assertion perlu diperbaiki saat guard bisnis diterapkan; jangan sekadar melonggarkan test agar hijau.

## 6. Usulan aturan bisnis yang dapat ditinjau sebelum pengeditan

1. **Status per dokumen konsisten:** kosong → diunggah/menunggu review → diterima atau ditolak/perlu revisi. Gunakan `diterima` sebagai nilai kanonis; nilai lama `lengkap`, jika harus didukung, perlu dipetakan dengan mempertimbangkan bukti unggahan/review. Jangan otomatis mempercayai status lama tanpa bukti.
2. **Review per berkas:** petugas yang berwenang membaca berkas, memilih Terima atau Tolak, dan mengisi alasan saat menolak. Simpan siapa, kapan, dan versi berkas yang diperiksa.
3. **Validasi file:** item yang kosong, BLOB hilang, atau versi berubah tidak dapat diterima. Jenis/ukuran file diperiksa mesin; kebenaran isi dan kecocokan identitas tetap penilaian petugas kecuali nanti dibuat fitur verifikasi tambahan.
4. **Reupload:** hanya berkas yang diganti kembali menjadi menunggu review. Persetujuan versi sebelumnya tidak otomatis berlaku untuk versi baru; berkas lain yang tidak berubah mempertahankan statusnya.
5. **Submit untuk pemeriksaan:** seluruh persyaratan wajib yang berlaku sudah diunggah dan tidak sedang ditolak tanpa perbaikan. Submit belum berarti semua sudah diterima.
6. **Teruskan ke bank:** seluruh dokumen wajib memiliki file yang valid dan status diterima pada versi terbaru. Satu berkas kosong, ditolak, atau menunggu review harus memblokir aksi dan menampilkan daftar berkas penghambat.
7. **Validasi di backend dan UI:** tombol boleh nonaktif untuk membantu pengguna, tetapi route forward/advance tetap menolak permintaan langsung yang melompati pemeriksaan atau tahap.
8. **Tahap dan revisi eksplisit:** perubahan dokumen setelah tahap bank memerlukan alur revisi terkontrol; tidak diam-diam mengubah dokumen yang sudah ditinjau.
9. **Data yang sudah terlanjur maju:** jangan otomatis menurunkan tahap, menghapus, atau menandai seluruh checklist diterima. Identifikasi pengajuan terdampak melalui pemeriksaan baca-saja, lalu tentukan rekonsiliasi dengan pemilik sistem.

Persyaratan berkas yang tidak berlaku bagi kasus tertentu perlu kebijakan tersendiri; jangan menganggap dokumen kosong otomatis boleh dilewati. Reuse dokumen lead membutuhkan pemetaan kategori ke checklist dan versi file yang jelas, bukan persetujuan otomatis.

## 7. Kriteria penerimaan perbaikan

- Super Admin dan Admin Operasional dapat menerima masing-masing berkas melalui tombol UI; hasil bertahan setelah refresh dan restart pada database uji.
- Menolak satu berkas dengan alasan hanya mengubah berkas terkait, menampilkan alasan, dan menghalangi penerusan pengajuan.
- Reupload berkas ditolak mengubah statusnya menjadi menunggu review; tujuh berkas lain tidak ikut direset.
- Semua berkas kosong, sebagian kosong, sebagian belum direview, serta satu berkas ditolak menghasilkan penolakan forward pada API, bukan hanya tombol nonaktif.
- Setelah semua syarat diterima pada versi yang benar, forward berhasil dan history mencatat aktor/waktu.
- Versi berkas yang berubah sejak petugas membukanya menghasilkan konflik/reload sebelum review disimpan, bukan persetujuan terhadap file yang belum dibaca.
- Pengguna tanpa role/cabang/bank-scope yang sesuai tetap ditolak; tombol UI sesuai izin tersebut.
- Dokumen yang tidak ada tidak diganti diam-diam dengan PDF simulasi sebagai bukti persyaratan.
- Fixture keamanan memasukkan unggahan/review yang nyata sebelum menguji tahap bank. Seluruh tes memakai data sintetis.

Komponen yang diperkirakan terdampak: `backend/src/server.js`, `frontend/src/pages/Progress.jsx`, tes API khusus dokumen, serta normalisasi data terbatas jika status legacy ditemukan. Pemetaan lead ke pengajuan dan rekonsiliasi data lama perlu ruang lingkup yang dinyatakan terpisah. **Belum ada patch diterapkan.**

## 8. Checksum acuan untuk pemeriksaan VPS

| File | SHA256 |
|---|---|
| `backend/src/server.js` | `530355fb04ccfb0c1aabc01223ae70b5d3144a7b6ccd83baba6c7a063a4aa5b3` |
| `backend/src/db/database.js` | `da003e4e0f5274048139531f0123b6e358b2cbe68ab8e1d38501a6089b266594` |
| `frontend/dist/index.html` | `70563dee3a6d245f46c7df1a025308e710676268535fd9299de37d0cad497fce` |
| `frontend/dist/assets/Progress-D0fDWUrm.js` | `1309ddc0e1e48758b7fbcc45acb06ec9ddb835f96166c96b010a314ce106fa3a` |

Backend acuan berasal dari arsip Git c693d42. Frontend acuan adalah build cloud dari commit/lockfile yang sama; nama bundle juga cocok dengan output build VPS yang diberikan pengguna. Perbedaan checksum perlu ditelusuri (termasuk kondisi build), bukan otomatis dianggap ada perubahan tidak sah.

Bukti lokal:

- [Reproduksi utama](/workspace/audit-2026-11-05/document-approval/reproduction.log)
- [Hasil terstruktur](/workspace/audit-2026-11-05/document-approval/results.json)


---

## 9. Status Implementasi & Resolusi Temuan (5 November 2026 WIB Malam)

Telah diimplementasikan perbaikan komprehensif pada backend, frontend, dan security test suite untuk menutup temuan audit persetujuan dokumen serta menyelaraskan kewenangan Sales Manager sesuai insight klien:

### A. Penutupan Bug Persetujuan Dokumen (P1)
1. **Whitelist & Normalisasi Status Dokumen**:
   - Endpoint `POST /api/applications/:id/documents/:key/review` kini menerima status `"diterima"` (dan menormalisasi `"lengkap"` legacy menjadi `"diterima"`).
   - Menolak (HTTP 400) review persetujuan dokumen jika berkas belum diunggah (`!doc.filename`).
   - Endpoint unduh dokumen `GET /api/applications/:id/documents/:key` mengembalikan HTTP 404 jika berkas belum diunggah (menghilangkan silent fake PDF).
   - Catatan revisi wajib diisi jika status `"ditolak"`. Reupload dokumen hanya mengubah status dokumen terkait menjadi `diunggah` tanpa mereset dokumen lain.

### B. Penguncian Tahapan Pengajuan (P1)
1. **Validasi Sebelum Pengajuan (Submit)**:
   - Endpoint `POST /api/applications/:id/action` dengan aksi `submit` mewajibkan seluruh 8 dokumen persyaratan telah diunggah dan tidak ada yang berstatus `ditolak` (HTTP 400 jika belum lengkap).
2. **Validasi Sebelum Diteruskan ke Bank (Forward & Advance)**:
   - Aksi `forward` dan aksi `advance` dari tahap `upload_dokumen` mewajibkan seluruh dokumen dalam checklist telah berstatus `"diterima"` dan memiliki berkas valid. Permintaan langsung yang melompati berkas ditolak dengan HTTP 400 disertai daftar berkas yang belum disetujui.
3. **Indikator & Proteksi UI (`Progress.jsx`)**:
   - Indikator kelengkapan memisahkan jumlah diunggah dan jumlah disetujui/diterima (`X/8 Diunggah • Y/8 Diterima`).
   - Tombol Terima/Tolak hanya muncul bagi petugas yang berwenang (`super_admin`, `admin_ops`, `admin_branch`) dan hanya pada dokumen yang berkas fisiknya sudah terunggah.
   - Tombol Submit dan Forward menampilkan notifikasi validasi jika syarat berkas belum terpenuhi.

### C. Penyelarasan Peran & Kewenangan Sales Manager (Insight Klien)
1. **Approval Klaim**:
   - Sales Manager dilarang menyetujui (`approve`) atau menolak (`reject`) klaim. Wewenang persetujuan & pencairan klaim mutlak berada di `super_admin` dan `admin_ops` (HTTP 403 jika diakses peran lain).
2. **Tambah Pengguna Baru**:
   - Penambahan tim baru dibatasi mutlak untuk `super_admin` dan `admin_ops` (`POST /api/users` -> HTTP 403 bagi Sales Manager). Tombol "Tambah Pengguna" di UI disembunyikan untuk Sales Manager.
3. **Perubahan Data Pengguna (Edit Tim)**:
   - Sales Manager berwenang mengubah profil tim marketing di cabangnya sendiri (`PATCH /api/users/:id` -> HTTP 200).
   - Dilarang keras mengubah pengguna di luar cabangnya (HTTP 403), dilarang mengubah role pengguna, dan dilarang memindahkan cabang tim.
4. **Fungsi Supervisi & Monitoring**:
   - Sales Manager difokuskan untuk melihat performa tim di cabangnya via Dashboard (leaderboard marketing, volume closing, pipeline) dan memantau status pembayaran insentif tim (melihat daftar klaim & bukti bayar yang telah disetujui/dibayarkan).
   - Navigasi Audit Log di sidebar disesuaikan khusus untuk `super_admin` dan `admin_ops`.

### D. Hasil Verifikasi Otomatis
- **Baseline Regression Backend (`npm test`)**: 19 lulus, 0 gagal.
- **Security, RBAC, Business Rules & Regression Test Suite**: 5/5 suite lulus 100% (termasuk verifikasi review status diterima, guard dokumen kosong, guard forward sebelum diterima, serta proteksi kewenangan Sales Manager).
- **Frontend Production Build (`npm run build`)**: Lulus, 2.598 modul ditransformasi tanpa error.

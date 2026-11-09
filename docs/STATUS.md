# Status Server dan Kesiapan Operasional — Layanan Pensiunan

Tanggal acuan konteks server: **8–9 November 2026** (Peluncuran operasional dengan data nyata dijadwalkan **Senin, 9 November 2026**).
Dasar fakta server: hasil audit folder, symlink, proses, dan file database yang dibuka oleh proses, dikirim pemilik pada 8 November 2026, serta catatan bertanggal perkembangan rilis dan CI pada 8–9 November 2026. Fakta historis persiapan (7 November 2026) dibedakan secara tegas dari hasil audit aktual ini.

## 1. Kondisi Server Aktual yang Terkonfirmasi oleh Audit (8 November 2026)

- **Symlink Rilis Aktif (`current`):** `/srv/layanan-pensiunan/current` mengarah ke `/srv/layanan-pensiunan/releases/layanan-pensiunan-c76e823-production` (pada saat audit 8 November 2026; lihat pembaruan status aktivasi fitur 8–9 November 2026 di Bagian 5).
- **Proses & Runtime:** Proses yang mendengarkan port aplikasi (`layanan-pensiunan-api` pada PM2) berjalan sebagai user layanan `lpapp` (satu instance mode *fork*, Node `24.22.2`), dengan *working directory* `/srv/layanan-pensiunan/releases/layanan-pensiunan-c76e823-production/backend` (pada saat audit 8 November 2026).
- **Baseline Commit Terpasang (Audit 8 November 2026):** Manifest rilis tersebut mencatat commit `c76e823db5a047807bea77ad6c03f2985e62560b` (branch asal baseline produksi: `fix/production-readiness-20261109` di repository `https://github.com/roveradmin1st/layanan_pensiun.git`). Commit tersebut adalah baseline runtime yang terkonfirmasi pada audit 8 November 2026; untuk rilis fitur `fe1025a94ebcb9ca6b078fa57e00287015ff8dc0` (`fix/release-operational-ux-20261108`) pada 9 November 2026, lihat Bagian 5.
- **Database Produksi Persisten:** Proses membuka `/srv/layanan-pensiunan/shared/data/enterprise.sqlite`, beserta sidecar `enterprise.sqlite-wal` dan `enterprise.sqlite-shm`. Dokumen unggahan disimpan sebagai BLOB di dalam SQLite.
- **Alamat Listen & Alur Jaringan:** Alamat listen backend yang ditemukan adalah `127.0.0.1:4000`. Alur layanan: Browser pengguna (tanpa VPN) → Nginx HTTPS (`https://139.190.106.136/`) → Node/Express (`127.0.0.1:4000`) → SQLite. Frontend React/Vite hasil build (`frontend/dist`) dilayani oleh aplikasi.
- **Kapasitas Disk:** Ruang disk tersedia sekitar **51 GB** dari filesystem **58 GB**. Tidak ada kebutuhan mendesak menghapus folder berdasarkan kapasitas ini.
- **Pemisahan Konteks User:** User SSH operator adalah `layananpensiunan`; user layanan adalah `lpapp`. State PM2 dalam HOME operator dan PM2 milik `lpapp` (`/var/lib/layanan-pensiunan/.pm2/`) adalah konteks yang berbeda.

> **Batas Fakta Audit 8 November 2026:** Audit ini **tidak** menghitung data nasabah/akun terkini, **tidak** memeriksa seluruh checksum kode terhadap GitHub, **tidak** membuktikan akses HTTPS terkini, dan **tidak** membuktikan integritas setiap backup. Jangan mengklaim pemeriksaan tersebut sudah dilakukan dari audit folder saja.

## 2. Peta Lokasi Server (VPS) dan Perannya

| Lokasi | Peran |
| --- | --- |
| `/home/layananpensiunan/layanan-pensiun-*` | Salinan sumber untuk persiapan/build terdahulu. **Bukan** penentu aplikasi yang sedang berjalan. |
| `/srv/layanan-pensiunan/current` | Penunjuk rilis produksi yang dipilih. Cocokkan juga dengan *working directory* proses. |
| `/srv/layanan-pensiunan/releases/` | Direktori rilis aplikasi; frontend hasil build berada di `frontend/dist`. |
| `/srv/layanan-pensiunan/shared/data/` | Database produksi persisten (`enterprise.sqlite`, `-wal`, `-shm`) beserta BLOB dokumen. |
| `/srv/layanan-pensiunan/backups/` | Arsip backup, termasuk data UAT sebelum aktivasi dan snapshot terjadwal. |
| `/etc/layanan-pensiunan/runtime.env` | Konfigurasi runtime rahasia, di luar Git (dilarang dibaca/disalin ke percakapan atau Git). |
| `/var/lib/layanan-pensiunan/.pm2/` | State PM2 milik akun layanan `lpapp`. |
| `/usr/local/lib/layanan-pensiunan/ops/` | Skrip operasional yang pernah dipasang; keberadaannya tidak membuktikan semuanya layak dipakai ulang. |

Salinan Git dalam HOME (`/home/layananpensiunan/`) pada saat audit 8 November 2026:

| Folder | HEAD | Posisi Git |
| --- | --- | --- |
| `layanan-pensiun-produksi-ac8af25` | `c76e823db5a0` | detached (nama foldernya bukan penentu versi kode) |
| `layanan-pensiun-update-01fa73b` | `01fa73b8fa4d` | detached |
| `layanan-pensiun-update-6df4925` | `6df4925e3731` | detached |
| `layanan-pensiun-uat` | `c693d42422da` | `fix/security-and-operational-integrity` |

- **Peringatan Symlink Data pada Rilis Lama:** Seluruh enam rilis yang tercatat dalam audit memiliki symlink `backend/data` menuju direktori `/srv/layanan-pensiunan/shared/data` yang sama. **Jangan menjalankan backend rilis lama untuk tes** karena proses itu dapat menulis ke database produksi. **Jangan memakai penghapusan rekursif yang mengikuti symlink** saat kelak membersihkan rilis.
- **Status Folder Persiapan/Arsip:** Folder `lp-production-prep-*`, `lp-migration-*`, `lp-restore-drill-*`, dan `lp-backup-downloads` adalah hasil persiapan/uji/arsip. Isinya tidak seluruhnya diperiksa dalam audit ini. Perlakukan sebagai **arsip tertunda** sampai dinilai satu per satu, bukan sebagai folder yang otomatis aman dihapus.

## 3. Prosedur yang Sudah Terbukti Bekerja vs. Rencana Otomasi / Alat Historis

| Komponen / Prosedur | Status Aktual & Aturan Penggunaan |
| --- | --- |
| **Aktivasi Manual Terkendali ke Rilis `c76e823` (Terbukti Bekerja)** | Aktivasi memakai `production_cutover.py` pernah gagal, lalu aktivasi diselesaikan melalui langkah manual yang diizinkan pemilik. Audit 8 November 2026 mengonfirmasi proses `lpapp` dan symlink `current` telah memakai rilis produksi `c76e823`. |
| **CI Validasi GitHub Actions & `ops/ci.py` (Terbukti Bekerja)** | CI validasi pada salinan database sementara sudah ada dan berjalan. Setiap perubahan yang gagal validasi wajib diperbaiki dahulu sebelum dipertimbangkan untuk rilis. |
| **Alur Kerja Update Terkendali (Prosedur Resmi)** | Alur baku: **pengembangan → pengujian → GitHub → CI berhasil → deployment saat diminta pemilik → verifikasi → catat versi** (lihat rincian di [SOP.md](SOP.md)). |
| **Snapshot Backup SQLite & Ekspor Terenkripsi (Terbukti pada Persiapan, Perlu Cek Berkala)** | Backup terenkripsi ke laptop pemilik dan uji pemulihan pernah berhasil pada tahap persiapan (bukti backup terdahulu, bukan jaminan salinan laptop sudah berisi transaksi produksi terbaru). Folder backup berkala terlihat pada audit, tetapi status timer dan keberhasilan backup terbaru harus diperiksa bila menjadi bagian tugas berikutnya. |
| **Deployment Rutin Satu Tombol (Rencana Otomasi — Belum Tersedia/Tervalidasi)** | Deployment rutin satu tombol adalah **sasaran perbaikan berikutnya**; belum terbukti tersedia dan aman untuk update produksi. Jangan menciptakan kesan setiap `git push` otomatis memperbarui VPS. |
| **Alat `ops/production_cutover.py` & Skrip Aktivasi Historis (Ditunda — Jangan Dipakai Ulang)** | Pemilik menunda riset/perbaikan alat deployment. Pembersihan data uji dan penyiapan akun adalah pekerjaan sekali saat transisi UAT ke produksi, bukan langkah rutin update aplikasi. **Jangan menjalankan ulang `production_cutover.py` atau skrip aktivasi historis untuk update rutin.** |
| **File `/srv/layanan-pensiunan/deploy.sh` (Belum Dinilai — Bukan Perintah Resmi)** | File `/srv/layanan-pensiunan/deploy.sh` ada di VPS, tetapi isi dan kesesuaiannya belum dinilai melalui audit 8 November 2026. **Jangan menganggap file itu perintah update resmi.** |

---

## 4. Riwayat Persiapan & Bukti Verifikasi Sebelumnya (Catatan Historis 7 November 2026)

> Bagian di bawah ini adalah catatan historis saat persiapan tanggal 7 November 2026 (sebelum aktivasi manual ke `c76e823` selesai dilakukan). Kandidat awal produksi disiapkan dengan 11 akun aktif dan 16 nonaktif sebagai riwayat persiapan, bukan hasil hitung akun terkini dari audit 8 November 2026.

Baseline patch: `01fa73b8fa4d433ab62cd15b3609fb46968c7155`, branch tugas `fix/production-readiness-20261109`.

Pemilik mengizinkan pelaksanaan perbaikan produksi dan SOP pada 7 November 2026 WIB. Pertahankan akun Super Admin utama, CEO dengan role super_admin dan seluruh bank, Agung Pambudi dengan role/cakupan yang sama, serta semua admin_ops/admin_branch. Daftar tersebut bukan batas lima akun. Selector email yang dikonfirmasi pemilik disimpan dalam policy privat, bukan source Git. Akun lain diusulkan nonaktif, bukan dihapus. Status aktif/nonaktif akun terlindungi tetap dipertahankan kecuali reaktivasi yang disetujui secara eksplisit. Konfirmasi terbaru pemilik: koreksi selector Agung berdasarkan inventory aktual, pertahankan role Sales Manager dan aktifkan kembali saat cutover.

Alur klaim yang disetujui pemilik: persetujuan dahulu, pembayaran kemudian dengan bukti transfer. Peluncuran 9 November memakai data nyata. Arsip UAT harus lengkap sebelum rencana pembersihan dijalankan.

### Perubahan di branch persiapan produksi (`fix/production-readiness-20261109`)

- Produksi tidak membuat database/data demo dan tidak mengganti state rusak dengan seed; pembaruan fixture hanya untuk development.
- Password scrypt dengan salt acak; migrasi hash lama setelah login sah; pembatasan login, revokasi token lama dan perubahan password saat pertama masuk.
- Berkas versi baru disimpan terpisah; penerimaan terikat versi/hash dan berkas asli. Perubahan berkas menggugurkan persetujuan sebelumnya.
- Klaim APPROVED terpisah dari PAID. Bukti pembayaran asli diperlukan dan nominal harus sesuai persetujuan.
- `ops/production.py` membuat inventory, rencana dan database calon produksi dari snapshot offline. Tidak ada perintah yang memasang atau membersihkan live DB.
- Backup SQLite terjadwal, pemeriksaan server, SOP dan CI pada data sementara.
- Nama cabang lama `PEMATNGSIANTAR` dan `BSI SIANTAR 2` dikenali sebagai `PEMATANGSIANTAR`, sesuai konfirmasi pemilik. API profil/pilihan SM menampilkan nama baku, tanpa mengubah role, bank_scope atau database kandidat yang telah dibuat. Dua Admin Cabang BSI tetap bsi_only. Pencatatan simulasi/pengajuan baru memakai nama cabang baku.
- `ops/check_candidate.py` menguji salinan fisik kandidat pada port loopback sementara. Semua akun aktif diuji login, gerbang password pertama, perubahan password pada salinan, restart kedua dan penolakan restore produksi. Checksum database kandidat serta file kredensial asli harus tetap identik; skrip tidak membaca runtime.env atau menjalankan PM2/Nginx.
- `ops/check_staged_release.py` memeriksa manifest/checksum rilis yang belum aktif, lalu menjalankannya dua kali dengan UID/GID lpapp dan salinan kandidat privat. Hanya link data dalam rilis yang belum aktif dipasang sementara dan kemudian dihapus; current, PM2, Nginx, runtime.env dan shared/data tidak diganti. Pengguna telah melaporkan UJI LPAPP BERHASIL pada VPS. Metadata root-owned tersimpan pada LPAPP-CHECK.json.
- `ops/production_cutover.py` memisahkan prepare dan apply (catatan 8 Nov 2026: aktivasi memakai alat ini sempat gagal dan akhirnya diselesaikan secara manual oleh operator atas izin pemilik; riset/perbaikan alat ini ditunda dan tidak dipakai untuk update rutin).

### Bukti dan batas verifikasi — 7 November 2026

- 33 tes Python lulus: 11 untuk calon produksi, 6 untuk backup/doctor/ekspor, 2 untuk siklus proses rilis sementara, dan 14 untuk persiapan/pergantian/pemulihan. Node nyata dipakai pada salinan uji rilis; pengujian mutasi Nginx/PM2 memakai seam layanan palsu serta perpindahan direktori/file nyata di folder sementara. Termasuk seluruh WAL/SHM lama terarsip sebagai satu direktori, tidak tercampur dengan data baru, kegagalan antarpemindahan direktori/startup/health/save/doctor, source yang berubah sebelum maintenance maupun sebelum stop selesai, serta larangan rollback setelah akses mungkin terbuka. Input pengguna baru dalam simulasi kegagalan pembukaan tetap terjaga.
- 52 tes backend lulus, termasuk penolakan DB produksi hilang/rusak tanpa seed, restart tidak memunculkan demo, scrypt, pembatasan login, revokasi sesi, gerbang ganti password, berkas asli/versi/hash dan pembayaran klaim dengan bukti. Tambahan regresi alias Siantar membuktikan penugasan SM berhasil, akun BSI tetap ditolak pada bank lain dan kedua peran tetap ditolak di MEDAN. Suite API keamanan/RBAC/regresi bisnis serta smoke produksi juga lulus.
- Build frontend serta 5 alur Chromium 155 lulus menggunakan data sintetis: login/gerbang password pertama, Pengaturan dengan restore nonaktif, pemilihan SM Siantar, penerimaan satu dokumen, serta APPROVED kemudian PAID dengan bukti. Integrasi plan → kandidat → semua login aktif → ganti password pada salinan → restart kedua lulus, dengan checksum kandidat/kredensial asli tetap sama. Screenshot/result tersedia pada `artifacts/browser/` lokal dan tidak masuk Git.
- Perintah lengkap awal: `python3 ops/ci.py --browser --system-chromium`, dengan npm ci dari lockfile, di cloud Node 24.22.1/Python 3.12. Validasi lengkap alat cutover lulus memakai flag `--skip-install`; setelah penyempurnaan fsync/guard, seluruh 33 tes operasi diulang dan lulus. Backend/frontend/dependensi runtime tidak berubah dari c76e823. Pin rilis/VPS Node 24.22.2. GitHub [run #3](https://github.com/roveradmin1st/layanan_pensiun/actions/runs/42374639256) untuk c76e823 Success 1m27s dan [run #4](https://github.com/roveradmin1st/layanan_pensiun/actions/runs/42377290829) untuk alat 5c71d41 Success 1m9s, diamati dari halaman publik.
- Validasi actionlint, parser unit systemd dan jadwal timer Asia/Jakarta lulus. Uji GPG AES256 enkripsi/dekripsi dengan checksum identik lulus pada byte sintetis.
- `npm audit --omit=dev`: backend 0 advisory, frontend 2 moderate pada react-router/react-router-dom (advisory redirect dan SSR hydration). Aplikasi memakai SPA BrowserRouter, bukan SSR hydration; penggunaan Link/navigate yang diperiksa menunjuk path internal. Temuan tetap dicatat, belum dianggap tertutup. Perbaikan yang ditawarkan npm melibatkan major v7; tidak dijalankan `audit fix --force`. Jadwalkan upgrade teruji setelah patch ini ditinjau. Build/dev dependency tidak termasuk angka audit produksi tersebut; Vite devserver tidak boleh dipasang sebagai server produksi.
- Pemulihan dari patch `c76e823` ke `01fa73b` tidak cukup dengan mengganti kode: hash password, identitas berkas dan kontrak persetujuan telah berubah. Setelah data produksi baru masuk, jangan memulihkan database lama secara otomatis karena dapat menghilangkan transaksi baru.
- Cabang default `main` sebelumnya tertinggal dari baseline bisnis; jangan deploy `main` lama atau force-push.
- Inventory VPS saat persiapan (7 Nov 2026): 27 akun (2 Super Admin termasuk CEO, 3 Admin Operasional, 5 Admin Cabang, 8 Sales Manager, 9 Marketing), 32 leads, 2 permintaan leads, 9 pengajuan, 14 simulasi, 5 klaim, 51 dokumen. Roster aktual dan policy tetap privat di luar Git. Rencana persiapan mempertahankan 11 akun dan menonaktifkan 16 lainnya.
- Backup manual VPS pada tahap persiapan dilaporkan berhasil dan metadata menunjukkan integrity ok, jumlah data sesuai inventory dan 51 dokumen. GPG VPS versi 2.4.4 tersedia. Pengguna sudah mengunduh arsip terenkripsi beserta checksum ke laptop (`CHECK_SUM COCOK`), lalu mengunggah kembali salinan laptop ke folder uji privat pada VPS (`UJI PEMULIHAN BERHASIL`).
- Pemilik menyampaikan hasil simulasi sudah diperiksa dan klien mengizinkan pemakaian untuk saat ini meski masih ada kendala. Daftar kendala akan dikumpulkan selama minggu pertama operasional lalu ditangani bersama. Jangan menyatakan semua bug telah selesai.


---

## 5. Status Pengembangan Fitur Operasional & Validasi Database Nyata (8–9 November 2026)

**Branch Tugas:** `feat/operational-ux-and-import-routing` (`2c20fd20c9272968c5da64f5dfb42e05ffad4e36`) dan branch perbaikan CI `fix/release-operational-ux-20261108` (`fe1025a94ebcb9ca6b078fa57e00287015ff8dc0`), berbasis commit rilis `c76e823db5a047807bea77ad6c03f2985e62560b`.

### Fitur yang Dikembangkan:
1. **In-App Document Preview Popup (Animasi Ringan):**
   - Komponen `FilePreviewModal.jsx` dan `Progress.jsx` ditingkatkan. Dokumen nasabah kini dibuka langsung di dalam aplikasi melalui modal responsif dengan animasi transisi halus (`animate-in fade-in-0 zoom-in-95 duration-200`) tanpa membuka tab peramban baru.
   - Admin dapat menyetujui (`Terima Dokumen`) atau menolak (`Tolak Dokumen`) langsung dari dalam modal preview.
2. **Unduh Semua Dokumen (.zip) Khusus Admin:**
   - Dibuat utilitas `backend/src/utils/zip-builder.js` murni Node.js (`node:zlib`) tanpa paket eksternal (zero-dependency).
   - Menghasilkan format PKZIP standar (Local Header, Central Directory, EOCD) dengan CRC-32 akurat dan sanitasi nama berkas anti-path traversal.
   - Tombol "Unduh Semua (.zip)" pada `Progress.jsx` mengunduh berkas dengan format nama kanonikal `Dokumen_Pengajuan_<NAMA_NASABAH>_<APP_NO>.zip`.
3. **Engine Impor Database Multi-Sheet & Smart Header:**
   - Dibuat parser `backend/src/utils/lead-import-parser.js` yang mendukung format `.xlsx` (ekstraksi ZIP native) dan `.csv`.
   - **Smart Header Detection:** Secara cerdas mendeteksi letak baris header (baris 0, 1, 2, dst.) dan mengabaikan banner/judul atau baris kosong di bagian atas file.
   - **Multi-Sheet Parsing:** Memindai seluruh lembar kerja (*sheet*) yang memuat data leads dan mengabaikan sheet non-data (seperti RAC/instruksi).
   - **Normalisasi Kontak & Nominal Riil:**
     - Menormalkan nomor HP berawalan 8 (`813...` → `0813...`), kode negara `+62`/`62`, nomor ganda (`62813.../62813...`), dan nomor yang digabung dengan NIK (`0813... & 1272...`).
     - Menangani pemisah desimal koma Indonesia (`5.225.500,00`), pemisah ribuan koma US (`111,565,606.33`), trailing tab/spasi, dan angka floating-point.
     - Mengekstrak tanggal lahir dari serial Excel, teks usia (`61 Tahun 5 bulan...`), maupun 18 digit NIP PNS.
     - Memetakan nama outlet/cabang (`KC PEMATANGSIANTAR PERINTIS`, `KCP PEMATANGSIANTAR SUTOMO`, `KCP INDRAPURA`, `Kemenag Simalungun`, `Kemenag Humbahas`) ke cabang kanonikal `PEMATANGSIANTAR`.
   - **Distribusi Leads:** Terhubung dengan Sales Manager cabang dan dialokasikan ke marketing via mode *round-robin*, antrean SM (*sm_queue*), atau *branch_pool*.
4. **Proteksi Kerahasiaan Nominal Insentif Marketing & SM:**
   - Nominal insentif disembunyikan (`null`, `amount_fixed: false`, label "Menunggu penetapan Admin") dari akun Marketing dan Sales Manager pada klaim berstatus DRAFT/SUBMITTED.
   - Admin Operasional / Super Admin memiliki input dan tombol "Tetapkan Nominal" (`POST /api/claims/:id/action` dengan `action: "set_amount"`).
   - Nominal insentif yang telah ditetapkan (*fixed*) baru akan tampil di akun Marketing dan Sales Manager.

### Hasil Validasi Pengujian:
- **Pengujian Database Riil Klien (`Sutomo_&_Perintis_-_Potensi_Pra_dan_Pensiun_OK_3.xlsx`):**
  - Berkas riil memuat 14 sheet (`Dataku`, `SLA Realtime Sutomo`, `SLA Realtime Perintis`, `Kemenag Simalungun`, `Kemenag Humbahas`, `PreApp 3 cbg`, `Pre App PerintisSutomo`, `PreApp Sutomo`, `PreApp Perintis`, `PreApp Indrapura`, `SLA Sutomo`, `SLA Perintis`, `SLA Indrapura`, dan 1 sheet RAC non-data).
  - Hasil ekstraksi: **945 calon debitur unik** berhasil diurai secara akurat tanpa error.
  - Seluruh nomor HP berhasil dinormalisasi ke awalan `08`, nominal gaji/plafond terkonversi ke integer bersih, dan seluruh outlet Siantar/Indrapura/Simalungun terpetakan ke `PEMATANGSIANTAR`.
- **Rangkaian Backend Test Suite:** **58 dari 58 pengujian LULUS 100%** (`tests 58, suites 0, pass 58, fail 0`).
- **Rangkaian Frontend Build:** `vite build` selesai sukses tanpa error (2599 modul terkompilasi bersih).

### Perbaikan jalur rilis setelah pemeriksaan CI lengkap (8–9 November 2026)

- Pemeriksaan terpisah atas commit fitur `2c20fd20c9272968c5da64f5dfb42e05ffad4e36` (`origin/feat/operational-ux-and-import-routing`) menjalankan `python3 ops/ci.py --skip-install --browser --system-chromium`. Sebanyak 33 tes operasi, build frontend, dan 58 tes backend lulus, tetapi suite API terintegrasi (`backend/tests/security-and-api.test.mjs`) berhenti pada perbandingan nominal klaim: respons Marketing sudah disamarkan menjadi `null`, sementara respons Admin tetap berisi nominal tersimpan. Karena itu, hasil 58 tes backend saja belum membuktikan seluruh CI lulus.
- Tes API diperbarui pada commit `fe1025a94ebcb9ca6b078fa57e00287015ff8dc0` (branch `fix/release-operational-ux-20261108`) untuk membandingkan nominal sebelum/sesudah permintaan ditolak melalui sudut pandang Admin yang sama, sekaligus memeriksa penyamaran pada endpoint detail/list/pengajuan, penolakan penetapan nominal oleh Marketing/SM, penetapan nominal oleh Admin tanpa mengubah status pembayaran, dan larangan mengubah nominal setelah PAID. Tidak ada kode runtime aplikasi atau database produksi yang diubah oleh perbaikan ini.
- Pemicu push workflow validasi (`.github/workflows/validate.yml`) mencakup seluruh branch, termasuk branch fitur. Workflow tetap hanya mempunyai izin `contents:read` dan tidak melakukan deployment.
- **Bukti CI GitHub Actions (8–9 November 2026):** Commit `fe1025a94ebcb9ca6b078fa57e00287015ff8dc0` pada branch `fix/release-operational-ux-20261108` telah lulus CI GitHub Actions dengan status **Success**: [run #42497169863](https://github.com/roveradmin1st/layanan_pensiun/actions/runs/42497169863).
- **Insiden Regresi Aktivasi & Status VPS per 9 November 2026:**
  - Sempat terjadi insiden di mana `/srv/layanan-pensiunan/current` menunjuk `layanan-pensiunan-2c20fd2-production`, sedangkan proses yang mendengarkan port `4000` masih berjalan dari `layanan-pensiunan-c76e823-production/backend` (mengubah symlink `current` saja tidak mengganti proses PM2).
  - Pada **9 November 2026**, pemilik melaporkan fitur sudah berjalan sesuai harapan setelah instruksi aktivasi diperbaiki. Sesuai aturan audit, **keluaran teknis PID/`current` pasca-aktivasi belum diterima di percakapan ini**, sehingga laporan tersebut dicatat sebagai laporan pemilik (belum diklaim sebagai verifikasi pemeriksaan server langsung sampai output `PID`/`cwd`/`current` diperiksa).
  - Backup terakhir yang dilaporkan sebelum aktivasi berisi `27 users, 225 leads, 1 application, 2 simulations, 1 claim, 9 files` (snapshot historis saat itu, bukan batas statis untuk transaksi baru berikutnya).

---

## 6. Audit Keamanan Otoritas, Isolasi Multi-Sales Manager & Sinkronisasi Admin (9 November 2026)

**Basis Kode:** Dibangun langsung di atas commit terverifikasi `fe1025a94ebcb9ca6b078fa57e00287015ff8dc0` (`origin/fix/release-operational-ux-20261108`).

### Lingkup Perubahan Aplikasi (`backend/` & `frontend/`):
1. **Isolasi Multi-Sales Manager dalam Satu Cabang (`backend/src/server.js`):**
   - Menghapus celah `PUSAT JAKARTA` pada `isGlobalBranchScope` sehingga hanya `super_admin` dan `admin_ops` yang memiliki cakupan nasional.
   - Menambahkan helper otorisasi tim (`isMarketingInSmTeam`, `isOwnedByAnotherSm`, `isLeadInSmScope`, `resolveSmForMarketing`, `canAccessLead`, `canAccessSimulation`, `canAccessApplication`, `canAccessClaim`, `canAccessImportBatch`, `scopeLeads`).
   - Pada cabang dengan banyak Sales Manager (Multi-SM), setiap `sales_manager` diisolasi secara ketat hanya pada anggota tim marketing miliknya (`mkt.manager_id === sm.id`) dan antrean pribadinya (`sales_manager_id === sm.id`), sehingga tidak dapat melihat atau mengubah pencapaian, prospek, simulasi, pengajuan, klaim, maupun akun marketing milik Sales Manager lain di cabang yang sama.
   - Menyembunyikan metrik rahasia perusahaan (`est_gross_revenue` / Gross Fee 4% dan `net_company_profit`) menjadi `null` pada `GET /api/dashboard` untuk peran non-pusat (`sales_manager`, `admin_branch`, `marketing`).
   - Memperbaiki perhitungan `mSims` pada `marketing_leaderboard` agar mencocokkan `s.marketing_id === m.id`, menambahkan atribut `manager_id` & `manager_name`, serta menambahkan blok `team_summary` bagi `sales_manager`.
2. **Sinkronisasi Kewenangan Admin Operasional & Admin Cabang:**
   - Mendukung penugasan prospek langsung ke antrean Sales Manager tertentu (`sm:<id>`) pada `POST /api/leads/assign` dan `PATCH /api/leads/:id`.
   - Mendukung distribusi impor database multi-SM yang adil pada `POST /api/imports` (termasuk fallback ke antrean SM jika SM target belum memiliki marketing aktif, serta penguncian `target_manager_id` otomatis saat `sales_manager` melakukan impor).
   - Melindungi antrean milik SM lain saat persetujuan `POST /api/lead-requests/:id/approve`.
   - Mengunci unggah ulang dokumen (`POST /api/applications/:id/documents/:key`) pada pengajuan yang sudah berstatus `DISBURSED`, `COMPLETED`, atau `REJECTED`.
   - Menjaga sinkronisasi mutasi `manager_id` pada `PATCH /api/users/:id` sehingga prospek aktif yang belum cair otomatis diperbarui `sales_manager_id` dan `sales_manager_name`-nya ke SM baru.
3. **Penyelarasan Antarmuka Frontend (`frontend/src/`):**
   - Membatasi rute `/audit` hanya untuk `centralOnly` (`super_admin`, `admin_ops`) pada `App.js` dan menyembunyikan kartu Gross Fee 4% / Net Profit / tautan Audit di `Dashboard.jsx` untuk peran cabang.
   - Menambahkan opsi `Antrean SM: <Nama>` (`sm:<id>`) dan badge `(SM: <Nama>)` pada `Leads.jsx`, `AssignDialog.jsx`, dan `LeadDetailSheet.jsx`, serta membuka tab `Permintaan Data Marketing` secara *read-only* bagi `sales_manager` dan `admin_branch`.
   - Mengunci pilihan target impor bagi `sales_manager` ke tim sendiri pada `ImportLeads.jsx`.
   - Menambahkan badge pihak (`ADMIN CABANG`, `SALES MANAGER`) dan filter cabang bagi `admin_ops` pada `Progress.jsx`.
   - Mengatur tampilan detail klaim menjadi *read-only* bagi `sales_manager` pada `Claims.jsx` dan membatasi tombol edit user bagi `sales_manager` hanya untuk anggota timnya di `Users.jsx`.

### Bukti Pengujian Lokal (9 November 2026):
- **Suite Isolasi Multi-SM & RBAC Baru (`node --test backend/tests/sm-isolation-and-rbac.test.mjs`):** **6/6 pengujian LULUS 100%** (mencakup isolasi cabang Multi-SM antara SM1/SM2/SM-BSI, proteksi finansial dashboard, penugasan `sm:<id>`, kuota permintaan prospek tanpa mencuri antrean SM lain, mutasi `manager_id`, batas cabang & bank `bsi_only` vs `all_bank`, serta stage lock dokumen `409` pada status `booking_live`).
- **Rangkaian Backend Test Suite Lengkap (`npm --prefix backend test`):** **64/64 pengujian LULUS 100%** (`tests 64, suites 0, pass 64, fail 0`).
- **Suite Keamanan & API Terintegrasi (`backend/tests/security-and-api.test.mjs` pada backend sementara):** **LULUS 100%** (`ALL SECURITY, RBAC, BUSINESS RULE & REGRESSION TESTS PASSED (100%)`), termasuk kontrak penyamaran nominal klaim dari `fe1025a`.
- **Frontend Production Build (`npm --prefix frontend run build`):** **LULUS** (`vite build` selesai bersih tanpa error).
- **Kerahasiaan Folder `Blue_Print/`:** Folder `Blue_Print/` ditarik dari pelacakan Git (`git rm -r --cached Blue_Print` dan ditambahkan ke `.gitignore`) atas instruksi pemilik agar dokumen rahasia perusahaan hanya tersimpan di lokal dan tidak di-push ke GitHub.

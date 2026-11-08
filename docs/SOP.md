# SOP Kerja, Alur Rilis, dan Operasional Produksi — Layanan Pensiunan

Laptop digunakan untuk pengembangan, GitHub untuk kontrol versi/review dan CI validasi, salinan sementara untuk pengujian, serta VPS (`https://139.190.106.136/`) sebagai target rilis produksi.
Aplikasi berjalan dalam **satu instance backend mode *fork*** (`layanan-pensiunan-api` oleh user layanan `lpapp` pada `127.0.0.1:4000`, Node `24.22.2`) karena state disimpan dalam memori proses. Snapshot SQLite wajib mencakup WAL dan BLOB dokumen; menyalin hanya file utama SQLite yang sedang aktif tidak boleh dijadikan satu-satunya metode backup.

---

## 1. Alur Baku Pengembangan hingga Rilis Produksi

Setiap perubahan mengikuti alur resmi 7 tahap berikut:

**`pengembangan → pengujian → GitHub → CI berhasil → deployment saat diminta pemilik → verifikasi → catat versi`**

1. **Pengembangan:**
   - Kerjakan di checkout kerja terpisah (idealnya pada laptop) dengan branch sesuai pekerjaan.
   - Pastikan berpijak pada baseline runtime produksi yang terpasang (`c76e823db5a047807bea77ad6c03f2985e62560b` dari branch `fix/production-readiness-20261109`) atau penerusnya yang sah, sehingga perbaikan keamanan produksi tetap terbawa. Jangan menganggap `main` lama atau branch dengan push terbaru otomatis layak dipasang tanpa memeriksa asal perubahannya.
2. **Pengujian:**
   - Jalankan tes yang relevan dan build (`python3 ops/ci.py` atau suite pengujian pada salinan database sementara).
   - Jangan pernah mengarahkan suite pengujian mutasi ke VPS dan jangan menjalankan backend rilis lama di VPS untuk tes (karena symlink `backend/data` mengarah ke `shared/data` produksi).
   - Ringkas perubahan kode serta dampaknya.
3. **GitHub:**
   - Lakukan `git commit` dan `git push` hanya sesuai permintaan pemilik.
   - Jangan menyamakan izin memperbaiki kode lokal dengan izin publikasi (`push`/`merge`) atau deployment.
4. **CI Berhasil:**
   - GitHub Actions (`.github/workflows/validate.yml`) memvalidasi commit yang di-push.
   - Perubahan yang gagal validasi CI wajib diperbaiki terlebih dahulu sebelum masuk tahap penerapan.
5. **Deployment Saat Diminta Pemilik:**
   - Hanya dilakukan setelah pemilik secara eksplisit meminta penerapan ke VPS.
   - Pilih commit spesifik yang sudah lulus CI, siapkan direktori rilis terpisah di `/srv/layanan-pensiunan/releases/`, buat snapshot backup SQLite yang konsisten (termasuk BLOB dokumen), dan uji perubahan/migrasi pada salinan data bila diperlukan.
   - **Jangan mengedit direktori rilis aktif** dan jangan menciptakan kesan bahwa setiap `git push` otomatis memperbarui VPS.
6. **Verifikasi:**
   - Lakukan aktivasi secara terkendali (arahkan symlink `/srv/layanan-pensiunan/current` dan proses PM2 milik `lpapp`).
   - Periksa proses (`lpapp`, 1 fork di `127.0.0.1:4000`), *working directory*, versi/manifest rilis, akses HTTPS (`https://139.190.106.136/`), fungsi login, dan keutuhan data/dokumen.
7. **Catat Versi:**
   - Catat hasil verifikasi aktual dan perbarui dokumen status ([STATUS.md](STATUS.md)) setelah perubahan benar-benar terjadi di server.

---

## 2. Pembedaan Prosedur yang Terbukti Bekerja vs. Rencana Otomasi / Alat Lama

- **Prosedur yang Sudah Terbukti Bekerja:**
  - **Validasi CI (`ops/ci.py` & GitHub Actions):** Sudah tersedia dan berjalan menguji kode pada salinan database sementara tanpa akses deploy.
  - **Aktivasi Rilis Manual Terkendali:** Rilis produksi `c76e823` saat ini terbukti berjalan stabil di VPS (`/srv/layanan-pensiunan/current` → `/srv/layanan-pensiunan/releases/layanan-pensiunan-c76e823-production`) setelah diaktifkan melalui langkah manual yang diizinkan pemilik.
  - **Snapshot SQLite Konsisten & Enkripsi GPG:** Backup menggunakan SQLite Backup API sebagai `lpapp` dan ekspor terenkripsi GPG ke laptop telah teruji pada tahap persiapan (status timer dan keberhasilan backup terbaru tetap wajib diperiksa saat bertugas).
- **Rencana Otomasi & Alat Lama yang Belum Tervalidasi / Ditunda (Jangan Diasumsikan Aktif):**
  - **Deployment Rutin Satu Tombol (*Automated Deployment*):** Baru merupakan sasaran perbaikan berikutnya; **belum tersedia dan belum tervalidasi aman** untuk update produksi.
  - **Alat `ops/production_cutover.py`:** Alat transisi satu kali dari UAT ke produksi ini pernah gagal saat aktivasi. Pemilik menunda riset/perbaikan alat deployment tersebut. **Jangan menjalankan ulang `production_cutover.py` atau skrip aktivasi historis untuk update rutin.**
  - **File `/srv/layanan-pensiunan/deploy.sh`:** File ini ada di VPS, tetapi isi dan kesesuaiannya belum dinilai dalam audit 8 November 2026. **Jangan menganggap file itu sebagai perintah update resmi.**
  - **Skrip di `/usr/local/lib/layanan-pensiunan/ops/`:** Keberadaan skrip yang pernah dipasang tidak membuktikan semuanya layak dipakai ulang tanpa pemeriksaan.

---

## 3. Keputusan Bisnis, Perlindungan Data & Batas Operasional

- **Peluncuran Operasional:** Dijadwalkan **Senin, 9 November 2026** menggunakan data nyata.
- **Pembersihan UAT adalah Pekerjaan Sekali Saja:** Pembersihan data uji dan penyiapan akun awal (11 akun aktif dan 16 nonaktif pada kandidat awal) adalah pekerjaan satu kali saat transisi UAT ke produksi, **bukan** langkah rutin saat update aplikasi.
- **Kewajiban Mempertahankan Data pada Update Berikutnya:** Pada setiap update berikutnya, **pertahankan seluruh data nasabah, akun, password, role, status aktif, hubungan Sales Manager–Marketing, wilayah, cakupan bank (`bank_scope`), parameter bank, dan dokumen BLOB** yang sudah ada, kecuali perubahan tertentu memang diminta pemilik.
- **Kredensial Produksi:** Password lama UAT tidak berlaku untuk akun produksi. Akun produksi menggunakan kredensial awal baru (`scrypt`) dan kewajiban mengganti password saat masuk pertama kali. Jangan meminta atau menampilkan isinya kepada AI.
- **Larangan Rollback Tidak Kompatibel & Edit DB Langsung:**
  - Jangan rollback hanya kode ke rilis UAT lama (`01fa73b`) karena kontrak password (`scrypt`), dokumen ber-versi/hash, dan klaim telah berubah.
  - Setelah data produksi baru masuk, jangan memulihkan database lama secara otomatis karena dapat menghilangkan transaksi baru.
  - Jangan mengedit file database SQLite secara langsung ketika aplikasi sedang berjalan karena state dalam memori proses Node.js dapat bertentangan dengan perubahan tersebut.
- **Aturan Akun & Wilayah yang Disepakati:**
  - Pertahankan Super Admin utama, CEO (`super_admin`/`all_bank`), Agung Pambudi (`sales_manager` yang direaktivasi dengan wilayah dan cakupan tetap), serta seluruh `admin_ops` dan `admin_branch`. Cocokkan dengan email/ID tepat; jangan menebak dari nama.
  - Wilayah Pematangsiantar: Agung dan dua Admin Cabang BSI di Siantar memakai wilayah `PEMATANGSIANTAR` yang sama. Nama lama `PEMATNGSIANTAR` dan `BSI SIANTAR 2` dikenali sebagai alias; hak dua Admin Cabang BSI tetap khusus BSI (`bsi_only`).
- **Alur Dokumen & Klaim:**
  - Admin membuka berkas terbaru sebelum menerima. Unggah ulang membentuk versi baru dan memerlukan pemeriksaan ulang. Berkas yang hilang ditangani sebagai masalah dokumen, bukan diganti dengan PDF contoh.
  - Klaim insentif disetujui dahulu (`APPROVED`); pembayaran (`PAID`) dicatat terpisah setelah transfer aktual disertai bukti transfer valid dan nominal yang sesuai.
- **Catatan Simulasi Klien:** Klien menerima penggunaan hasil simulasi saat ini dengan kendala yang akan dikumpulkan selama minggu pertama operasional untuk ditangani bersama. Jangan menyatakan semua bug telah selesai.

---

## 4. Cara Berkolaborasi antara AI dan Pemilik

- **Rujukan Dinamis:** Periksa [`Blue_Print/command.md`](../Blue_Print/command.md) untuk instruksi terbaru dari pemilik/ahli, serta cocokkan dengan [STATUS.md](STATUS.md), `SOP.md` ini, dan [RUNBOOK.md](RUNBOOK.md).
- **Penjelasan Sebelum Tindakan:** Jelaskan tujuan dan hasil yang akan diperoleh sebelum memberi perintah atau mengubah kode.
- **Disiplin Lingkup Tugas:**
  - Batasi pekerjaan hanya pada masalah yang diminta; hindari menambah sistem otomasi atau dependensi yang belum dibutuhkan.
  - Untuk pertanyaan/diskusi, berikan analisis tanpa mengubah file.
  - Gunakan bukti terbaru yang tersedia; jangan mengulang seluruh pemeriksaan dari awal setiap sesi.
  - Jika Antigravity sedang terhubung melalui Remote SSH ke VPS, ingat bahwa terminal dan perubahan file berlaku langsung pada VPS. Pastikan selalu lokasi mesin, direktori kerja, dan branch sebelum mengubah apa pun.
- **Tindakan yang Membutuhkan Izin Eksplisit:** Jangan melakukan reset data, reset password, penghapusan arsip/folder, perubahan konfigurasi server, `git push`, `git merge`, atau deployment tanpa permintaan pemilik yang mencakup tindakan tersebut.
- **Kerahasiaan Ketat:** Jangan pernah membaca, menyalin, atau menampilkan nilai rahasia ke percakapan atau Git: `/etc/layanan-pensiunan/runtime.env`, file kredensial privat, private key, token, dan keluaran PM2 lengkap (`pm2 env` / `pm2 jlist`) yang memuat environment.
- **Format Laporan Perubahan:** Saat pekerjaan memerlukan perubahan, laporkan secara singkat: **masalah, perubahan, pengujian, commit, dan apakah VPS sudah diperbarui atau belum**.

---

## 5. Referensi Tahapan Persiapan Sebelumnya (Historis Transisi UAT → Produksi)

1. **Catat kondisi aktual:** Baca `cwd` proses PM2 dan versi rilis; verifikasi backend hanya `127.0.0.1:4000`, Nginx/TLS, timer Certbot, startup PM2, dan kapasitas.
2. **Arsipkan UAT:** Buat snapshot SQLite konsisten sebagai `lpapp`, enkripsi GPG, simpan di laptop pemilik, dan uji pemulihan di lokasi terpisah.
3. **Siapkan rencana & kandidat (pekerjaan satu kali pra-peluncuran):** Gunakan `ops/production.py` pada snapshot offline untuk menyiapkan kandidat awal tanpa menyentuh `shared/data` live.
4. **Uji kandidat & rilis:** Gunakan `ops/check_candidate.py` dan `ops/check_staged_release.py` pada salinan sementara, serta `python3 ops/ci.py` di checkout pengembangan.
5. **Aktivasi & verifikasi:** Aktivasi rilis produksi `c76e823` telah diselesaikan secara manual dan terkonfirmasi pada audit 8 November 2026 (lihat [STATUS.md](STATUS.md)).

Pegangan terkait: [STATUS.md](STATUS.md), [RUNBOOK.md](RUNBOOK.md), [CHECKLIST-PEMILIK.md](CHECKLIST-PEMILIK.md), dan [MULAI-DI-SINI.md](MULAI-DI-SINI.md).

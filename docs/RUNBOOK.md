# Runbook Operasional dan Riwayat Persiapan Produksi

Mulai selalu dari [STATUS.md](STATUS.md), [SOP.md](SOP.md), dan instruksi aktif di [`Blue_Print/command.md`](../Blue_Print/command.md).

## Update rutin dengan controller rilis (9 November 2026)

Pemilik telah meminta pengambilalihan perbaikan dan penerapan ke VPS. Gunakan
paket commit yang lulus pengujian, tanpa reset akun atau database. Instalasi
controller dan aktivasi aplikasi merupakan dua langkah terpisah; jangan
menganggap CI hijau sebagai bukti VPS sudah diperbarui.

Setelah checkout operator dipin ke commit yang ditinjau, pemasangan pertama:

```bash
sudo install -d -o root -g root -m 755 /usr/local/lib/layanan-pensiunan/ops
sudo install -o root -g root -m 644 ops/server_release.py /usr/local/lib/layanan-pensiunan/ops/server_release.py
sudo install -o root -g root -m 755 ops/lp-release /usr/local/bin/lp-release
sudo /usr/local/bin/lp-release status
```

Pemasangan ini tidak mengaktifkan rilis. `server_backup.py` terpasang yang sudah
teruji tetap digunakan. Ambil paket `runtime-release-<full SHA>` dari successful
**push** run `validate.yml` commit yang disetujui, bukan paket PR dengan SHA merge.
Ekstrak ZIP unduhan GitHub di laptop lalu unggah `release-<full SHA>.tar.gz` ke
folder operator VPS. Simpan path sebenarnya pada `lp_archive` dan full SHA pada
`lp_commit`, lalu jalankan pemeriksaan sebelum aktivasi:

```bash
sudo /usr/local/bin/lp-release plan --archive "$lp_archive" --commit "$lp_commit"
```

Hasil harus `plan_ready` dengan rilis lama sesuai proses yang sebenarnya. Bila
`CURRENT_PID_MISMATCH`, hentikan alur dan periksa proses/current; jangan
mengganti symlink berdasarkan tebakan. Untuk aktivasi yang telah diminta pemilik:

```bash
sudo systemd-run --unit="lp-release-${lp_commit}" --collect --wait \
  --property=Type=oneshot --property=TimeoutStartSec=900 \
  /usr/local/bin/lp-release apply --archive "$lp_archive" --commit "$lp_commit"
sudo /usr/local/bin/lp-release status
sudo python3 -I /usr/local/lib/layanan-pensiunan/ops/server_doctor.py
```

Systemd meneruskan operasi bila terminal terputus; periksa unit/receipt yang sama
sebelum mencoba ulang. Tepat satu backend membutuhkan restart singkat. Bukti
selesai adalah receipt `active_verified`, proses/current/commit yang cocok,
HTTPS berfungsi, dan pemeriksaan fungsi oleh pemilik. Pemulihan otomatis hanya
mengembalikan kode kompatibel dan tidak memulihkan database lama.

Untuk tombol GitHub, `deploy.yml` harus dipublikasikan ke default branch serta
Environment `production` dikonfigurasi dengan `DEPLOY_SSH_KEY`,
`DEPLOY_SSH_KNOWN_HOSTS` yang diverifikasi dan akses sudo controller yang
dibatasi. Jangan membagikan key/password melalui chat. Sampai konfigurasi itu
selesai dan diuji, gunakan controller yang sama melalui terminal operator.

## Status Operasional Penting (Acuan Audit 8 November 2026)

1. **Rilis Produksi Sudah Aktif (`c76e823`):**
   - Symlink `/srv/layanan-pensiunan/current` dan proses aktif (`lpapp`, 1 instance *fork* pada `127.0.0.1:4000`, Node `24.22.2`) telah menjalankan `/srv/layanan-pensiunan/releases/layanan-pensiunan-c76e823-production` (commit `c76e823db5a047807bea77ad6c03f2985e62560b`) dengan database `/srv/layanan-pensiunan/shared/data/enterprise.sqlite` (+ `-wal`, `-shm`).
2. **Alur Update Berikutnya (Baku):**
   - **`pengembangan → pengujian → GitHub → CI berhasil → deployment saat diminta pemilik → verifikasi → catat versi`**
   - Setiap update wajib mempertahankan seluruh data, akun, password, role, status aktif, relasi SM–Marketing, wilayah, cakupan bank, parameter bank, dan dokumen BLOB yang sudah ada.
3. **Batas Prosedur yang Terbukti vs. Rencana Otomasi / Alat Historis:**
   - **Sudah Terbukti Bekerja:** Validasi lokal/CI (`python3 ops/ci.py` pada database sementara), pemeriksaan kandidat/rilis pada salinan sementara (`ops/check_candidate.py`, `ops/check_staged_release.py`), snapshot backup SQLite konsisten sebagai `lpapp`, enkripsi GPG ke laptop, dan aktivasi rilis manual terkendali.
   - **Ditunda / Jangan Dijalankan Ulang untuk Update Rutin:**
     - `ops/production_cutover.py`: Pernah gagal saat aktivasi transisi UAT→produksi (aktivasi kemudian diselesaikan secara manual atas izin pemilik). Pemilik menunda riset/perbaikan alat ini. **Jangan menjalankan ulang `production_cutover.py` atau skrip aktivasi historis untuk update rutin.**
     - `/srv/layanan-pensiunan/deploy.sh`: Ada di VPS, namun isi dan kesesuaiannya belum dinilai dalam audit 8 November 2026. **Jangan menganggap file ini sebagai perintah update resmi.**
     - **Deployment rutin satu tombol:** Baru merupakan sasaran perbaikan berikutnya dan belum tersedia/tervalidasi untuk produksi. Setiap `git push` tidak otomatis memperbarui VPS.

---

## Inventory dan kandidat (Catatan Prosedur Transisi Awal UAT → Produksi)

> Perintah di bawah ini adalah dokumentasi prosedur satu kali saat menyiapkan kandidat awal dari arsip UAT di folder privat operator (bukan `shared/data` live, dan bukan langkah update rutin setelah produksi berjalan). Gunakan Python 3.12 dan Node versi `.node-version`.

```bash
umask 077
python3 ops/production.py inventory --database /path/arsip-uat.sqlite
python3 ops/production.py plan --database /path/arsip-uat.sqlite --policy /path/policy.private.json --output /path/plan.json
python3 ops/production.py prepare --database /path/arsip-uat.sqlite --plan /path/plan.json --output-dir /path/calon-produksi-baru
python3 ops/production.py verify --database /path/calon-produksi-baru/production.sqlite
```

Template policy; isi dengan selector tepat yang dikonfirmasi pemilik, simpan 600 di folder 700:

```json
{
  "primary_superadmin_email": "superadmin@example.invalid",
  "ceo_email": "ceo@example.invalid",
  "agung_email": "agung@example.invalid",
  "extra_keep_emails": [],
  "reactivate_emails": ["agung@example.invalid"]
}
```

Plan menampilkan semua akun, usulan aktif/role, kelompok bisnis yang akan kosong dan dependensi manager. Seluruh admin_ops/admin_branch wajib masuk daftar terlindungi. CEO menjadi super_admin/all_bank. Role/cabang/bank Agung tetap. `reactivate_emails` hanya berisi selector tepat untuk akun terlindungi yang telah disetujui untuk aktif kembali; kosongkan jika tidak ada. Konfirmasi terbaru pemilik mengaktifkan kembali Agung sebagai Sales Manager, tanpa mengubah status akun admin nonaktif lainnya. Source berubah setelah plan dibuat menyebabkan prepare ditolak. Folder keluaran harus baru.

Hasil prepare: `production.sqlite`, `plan.json`, `result.json` dan `credentials.private.json`. Tiga berkas pertama untuk pemeriksaan operator; kredensial hanya untuk penyerahan privat. Hasil CLI tidak mencetak password. Prepare tidak memasang database di server, tidak menjalankan PM2 dan tidak menghapus arsip.

Jika email tidak ditemukan, periksa inventory dan koreksi selector dengan pemilik; tidak ada pencocokan sebagian nama. Jika ada data nyata dalam arsip UAT, hentikan rencana mengosongkan semua koleksi dan tentukan data yang harus dipindahkan.

### Memeriksa kandidat yang sudah dibangun

Dari checkout persiapan yang dipin ke commit hasil review, dengan dependency backend terpasang dan `frontend/dist` sudah dibangun:

```bash
nice -n 10 python3 -I ops/check_candidate.py --candidate /path/folder-privat/candidate
```

Perintah ini tidak memerlukan sudo. Skrip membuat salinan fisik database di folder privat sementara milik operator, menjalankan dua proses Node secara berurutan hanya pada 127.0.0.1 dengan port acak, lalu menghentikan proses dan menghapus folder sementara. Ia tidak memakai PM2, runtime.env, port 4000, shared/data atau Nginx. Tidak menerima URL API eksternal. Jalankan satu pemeriksaan pada satu waktu; scrypt memakai RAM/CPU sehingga prioritas diturunkan dengan nice.

Semua password sementara dibaca secara privat untuk menguji akun aktif; tidak ditampilkan atau diganti pada kandidat asli. Perubahan password/revokasi sesi hanya dicoba pada salinan yang dibuang. Hasil `UJI KANDIDAT BERHASIL` memerlukan checksum kandidat dan kredensial asli identik, data bisnis tetap kosong, master bank sama, gerbang ganti password bekerja, cookie Secure/HttpOnly dan restore produksi ditolak. Metadata saja disimpan pada `candidate-check.json` di folder induk kandidat. Hasil ini belum membuktikan permission lpapp, Nginx/TLS, reboot VPS atau penerimaan angka perhitungan oleh klien.

Pemilik telah menyetujui alias `PEMATNGSIANTAR` dan `BSI SIANTAR 2` sebagai wilayah PEMATANGSIANTAR yang sama. Alias diterapkan pada pengenalan cabang dan API profil/pilihan SM; bank_scope tetap terpisah. Kandidat lama berformat `lp-production-20261109-v1` tetap kompatibel dan tidak perlu dibuat ulang untuk perbaikan alias ini.

### Memeriksa rilis sebagai lpapp

Alat operasi mempunyai versi tersendiri dari aplikasi. Untuk persiapan ini kode aplikasi tetap dipin ke c76e823 yang sudah lulus GitHub Actions dan uji kandidat VPS. Publikasi alat pemeriksaan tidak meminta build atau checkout ulang aplikasi. Ambil file alat dari commit operasi yang direview, verifikasi SHA256, lalu pasang root-owned seperti alat backup sebelum menjalankan:

```bash
sudo python3 -I /usr/local/lib/layanan-pensiunan/ops/check_staged_release.py \
  --release /srv/layanan-pensiunan/releases/layanan-pensiunan-c76e823-production \
  --candidate /path/folder-privat/candidate \
  --commit c76e823db5a047807bea77ad6c03f2985e62560b
```

Rilis wajib belum aktif, root-owned, sesuai DEPLOYMENT.json dan belum mempunyai backend/data. Database kandidat serta candidate-check.json harus cocok dengan commit dan checksum yang telah diuji. Alat menahan .deploy.lock, membuat salinan fisik kandidat di folder privat sementara, memasang link data hanya dalam rilis yang belum aktif, lalu menjalankan dua startup Node sebagai UID/GID lpapp dengan secret uji acak di environment. Port acak hanya 127.0.0.1. HTML harus sama, API anonim 401 dan quick-role 403. Proses dihentikan sebelum link/data uji dihapus, termasuk saat HTTP check gagal.

Hasil UJI LPAPP BERHASIL disimpan pada LPAPP-CHECK.json root-owned dalam rilis. candidate_unchanged/temporary_processes_stopped/temporary_data_removed harus true, live_release_changed/live_database_modified/release_data_link_present harus false. Tidak ada password dibaca/dicetak, runtime.env dimuat, shared/data dibuka, PM2 dipanggil atau Nginx diubah. Pemeriksaan ini belum membuktikan reboot aktual maupun penerimaan perhitungan bank oleh klien. Jangan membuat link ke shared/data atau menyalakan rilis baru sebelum rencana cutover selesai.

## Pemeriksaan server dan backup

Skrip serta unit backup dipasang root-owned setelah review. Backup berjalan dengan SQLite worker lpapp dan hasil disimpan root 700/600. Pengujian lokal bukan bukti timer/HTTPS/reboot aktual pada VPS. Catat hasil server dan tujuan offsite sebelum menyatakan siap.

Pemilik memilih **laptop pribadi dahulu** sebagai lokasi offsite. Urutan install berikut dilakukan dari checkout commit yang sudah direview pada VPS, bukan dari folder kode yang sedang berjalan. Ini hanya memasang alat operasi dan penjadwalan backup, tidak mengaktifkan patch aplikasi atau mengganti database. Jangan gunakan controller deploy draft lama `enterprise-state-v1` untuk database BSI products v2/format produksi baru.

```bash
sudo install -d -o root -g root -m 755 /usr/local/lib/layanan-pensiunan/ops
sudo install -o root -g root -m 644 ops/server_backup.py ops/server_doctor.py ops/server_export.py /usr/local/lib/layanan-pensiunan/ops/
sudo install -o root -g root -m 644 ops/systemd/lp-backup.service ops/systemd/lp-backup.timer /etc/systemd/system/
sudo systemd-analyze verify /etc/systemd/system/lp-backup.service /etc/systemd/system/lp-backup.timer
sudo systemctl daemon-reload
sudo systemctl start lp-backup.service
sudo systemctl enable --now lp-backup.timer
sudo systemctl list-timers lp-backup.timer --all
sudo python3 -I /usr/local/lib/layanan-pensiunan/ops/server_doctor.py
```

Doctor memeriksa process/current, loopback, permission/env tanpa mencetak secret, TLS dengan sisa minimal 48 jam, timer, kapasitas, hash backup dan password/format produksi. Sebelum cutover format/password produksi akan gagal karena UAT memang belum dibersihkan; hasil tersebut bukan perintah untuk menghapus data. Doctor tidak membuktikan reboot, satu fork dari daftar tersimpan, penerimaan perhitungan bank atau salinan laptop. Semua itu tetap perlu bukti terpisah. Worker backup menggunakan SQLite Backup API sebagai lpapp sehingga mencakup transaksi WAL dan byte dokumen. Backup tidak melakukan reset, restore, vacuum/checkpoint pada sumber live, atau pruning otomatis. Lock `.deploy.lock` dan `.ops.lock` harus juga dipakai operator cutover agar tidak bertabrakan.

### Enkripsi dan unduh ke laptop

Pastikan GnuPG tersedia (`gpg --version`; jika belum, paket Ubuntu `gnupg`). Pada terminal SSH interaktif akun biasa jalankan:

```bash
sudo systemctl start lp-backup.service
sudo python3 -I /usr/local/lib/layanan-pensiunan/ops/server_export.py
```

GPG meminta passphrase tanpa menampilkan ketikan; mode loopback dapat meminta sekali saat enkripsi. Uji dekripsi terpisah meminta kata sandi kembali. Gunakan passphrase panjang yang unik dan simpan di pengelola kata sandi, terpisah dari file backup. Jangan masukkan passphrase ke argumen perintah/chat. Skrip mengambil snapshot terbaru yang sudah lolos checksum dan berumur maksimal 90 menit, mengenkripsi AES256 di folder root privat, lalu menyerahkan **file terenkripsi saja** ke `~/lp-backup-downloads/` milik operator. Ia menampilkan path, SHA256 file terenkripsi dan SHA256 database untuk uji pemulihan. Tidak ada password aplikasi atau dokumen dicetak.

Di Explorer Antigravity buka `lp-backup-downloads`, klik kanan file `.sqlite.gpg` → Download ke folder backup laptop. Pada PowerShell lokal laptop:

```powershell
Get-FileHash -Algorithm SHA256 'C:\lokasi-backup\nama-file.sqlite.gpg'
```

Cocokkan dengan `sha256` hasil ekspor. Catat hasil, waktu dan lokasi pada checklist privat. File di folder unduhan VPS saja belum merupakan offsite. Pertahankan set harian 7 hari dan mingguan 4 minggu; jangan menghapus arsip terakhir yang sudah teruji. Pantau ruang tiap hari; pruning manual hanya setelah salinan laptop dan pemulihan terverifikasi. Retensi dapat disesuaikan kemudian dengan kebutuhan perusahaan.

### Uji pemulihan tanpa menyentuh live

Pakai file yang benar-benar sudah diunduh ke laptop. Gpg4win/Kleopatra dari situs resminya dapat mendekripsi `.gpg` di Windows. Lakukan di folder laptop yang dilindungi enkripsi disk/akses pemilik. Bandingkan `Get-FileHash` hasil `.sqlite` dengan `database_sha256` ekspor; harus identik. Hapus salinan plaintext setelah uji; simpan arsip terenkripsi. Alternatif: unggah kembali file terenkripsi dari laptop ke **folder baru operator** pada VPS, lalu dekripsi sebagai akun biasa (`umask 077`) ke folder uji itu saja dan jalankan `ops/production.py verify --database /path/folder-uji/restore.sqlite`. Bandingkan SHA256 hasil dekripsi dengan checksum ekspor dan jumlah record/berkas dengan snapshot. Jangan memakai path `/srv/.../shared/data` sebagai tujuan dekripsi, restore atau pengujian.

Cadangan yang pernah dipulihkan tidak berarti boleh menimpa data produksi terbaru. Sebelum cutover, hasil uji dan roster kandidat tetap ditinjau. Sesudah operasional, pemulihan perlu maintenance serta rekonsiliasi setiap input sejak waktu snapshot.

Pemulihan di browser produksi diblokir. Cadangan JSON bisa lebih besar dari batas unggahan dan bukan jalur pemulihan produksi. Operator memakai backup SQLite pada jendela maintenance; byte dokumen harus ikut diuji.

## Jika terjadi masalah saat pergantian

Sebelum trafik dibuka dan tanpa penulisan baru, operator dapat mengembalikan pasangan kode/database/config sebelum cutover. Setelah trafik mungkin terbuka, pertahankan data terbaru dan tutup input untuk pemeriksaan. Pilih perbaikan maju atau rekonsiliasi; jangan menimpa database dengan snapshot lama. Simpan direktori data dan sidecar sebagai satu kesatuan, verifikasi tidak ada proses lama yang masih membuka DB sebelum mengganti direktori.

Jangan membagikan runtime.env, token, pm2 jlist/env, kredensial sementara atau isi dokumen. Log operasional yang dibagikan cukup status, commit, checksum, waktu dan jumlah record.

## Arsip Historis: Persiapan dan Aktivasi UAT Menjadi Produksi (`production_cutover.py` — Ditunda)

> **PERINGATAN (8 November 2026):** Aktivasi memakai `production_cutover.py` pernah gagal, lalu aktivasi ke rilis produksi `c76e823` diselesaikan melalui langkah manual yang diizinkan pemilik. Pemilik menunda riset/perbaikan alat ini. **Jangan menjalankan ulang `production_cutover.py` untuk update rutin.** Dokumentasi di bawah ini dipertahankan hanya sebagai arsip referensi historis.

`production_cutover.py` adalah alat bootstrap produksi pertama untuk state BSI products v2 yang belum mempunyai production_format. Ia tidak dipakai untuk update kode rutin atau mengosongkan database produksi yang sudah berjalan. Kode aplikasi tetap c76e823; alat operasi diambil dari commit yang direview dan dipasang root-owned secara terpisah. Verifikasi SHA256 file sebelum install.

Persiapan tidak memerlukan penghentian aplikasi:

```bash
sudo python3 -I /usr/local/lib/layanan-pensiunan/ops/production_cutover.py prepare \
  --release /srv/layanan-pensiunan/releases/layanan-pensiunan-c76e823-production \
  --candidate /path/folder-privat/candidate \
  --reviewed-plan-sha256 CHECKSUM_PLAN_UAT_YANG_DISETUJUI
```

Prepare memeriksa manifest/checksum dan bukti lpapp, Node, process/current, saved list tepat satu fork, serta doctor (format/password UAT memang belum lolos). Ia membuat snapshot konsisten sebagai lpapp menggunakan worker backup terpasang, kemudian menghitung fingerprint state dan seluruh BLOB dengan format yang sama dengan plan awal. Jika fingerprint berbeda, ia berhenti tanpa maintenance/pergantian dan menyimpan snapshot untuk review. Perubahan audit/login pun dapat menyebabkan penolakan ini; jangan mengubah checksum supaya lolos.

Jika cocok, kandidat dibekukan sebagai salinan root 600 di folder root 700 bersama snapshot, Nginx, runtime.env dan saved list privat. Master/parameter serta riwayat migrasi wajib identik, password aktif harus scrypt, target bisnis/BLOB kosong, source belum format produksi. Rencana aktivasi mengikat SHA256 kandidat, kode, alat operasi, ENV, Nginx, saved list dan bukti lpapp. `RENCANA AKTIVASI SIAP` hanya mencetak metadata/jumlah data serta path/checksum plan; belum mengaktifkan apa pun. Jangan membagikan isi folder privat tersebut.

Setelah hasil konkret ditinjau dan waktu maintenance disepakati, jalankan apply melalui unit systemd agar tidak bergantung pada koneksi SSH. Gunakan path/checksum keluaran prepare yang sebenarnya, bukan placeholder berikut:

```bash
sudo systemd-run --unit=lp-production-cutover --wait --collect \
  --property=Type=oneshot --property=TimeoutStartSec=1200 --property=TimeoutStopSec=180 \
  /usr/bin/python3 -I /usr/local/lib/layanan-pensiunan/ops/production_cutover.py apply \
  --plan /srv/layanan-pensiunan/backups/FOLDER_AKTUAL/plan.json \
  --plan-sha256 CHECKSUM_PLAN_AKTIVASI_AKTUAL \
  --confirm-clean-reviewed-uat
```

Apply memverifikasi ulang seluruh ikatan dan fingerprint sebelum maintenance. Ia menutup proxy aplikasi dengan 503 sambil mempertahankan ACME/HTTPS, memastikan status publik 503, menghentikan satu proses, membuat backup terakhir dan memeriksa fingerprint lagi. Data baru yang sempat committed sebelum stop membatalkan pergantian tanpa menghilangkan input itu. Setelah tidak ada handle database lain, seluruh direktori data lama termasuk WAL/SHM diarsipkan, kemudian direktori kandidat dipasang. Kode/current/data dijalankan sebagai pasangan baru, satu fork lpapp, HTML/API/fingerprint diverifikasi, saved list disimpan, backup produksi awal dibuat dan doctor diperiksa sebelum akses dibuka.

Jika gagal sebelum pembukaan, alat mengembalikan direktori data asli bersama kode/saved list lama; data baru yang gagal disimpan untuk pemeriksaan. Ia tidak memulihkan snapshot lama di atas input baru. Jika pembukaan mungkin sudah dicoba, rollback otomatis dilarang: data terbaru tetap, penutupan publik diupayakan dan status keberhasilannya dicatat. Periksa status/journal privat; jangan mengulang apply atau melakukan reset/restore. Plan yang sudah dipakai tidak dapat diterapkan ulang. Gangguan daya/kill yang tidak bisa ditangani memerlukan pemeriksaan manual journal dan direktori pasangan.

Aktivasi bukan bukti reboot. Uji reboot/startup aktual tetap dilakukan pada jendela yang disepakati, lalu jalankan doctor, periksa login pemilik akun melalui HTTPS dan verifikasi backup terenkripsi terbaru di laptop. Setelah trafik berpotensi terbuka, pemulihan selalu mempertimbangkan input sejak snapshot. Untuk insiden, bagikan status ringkas saja; raw PM2 JSON dan konfigurasi privat mengandung secret.

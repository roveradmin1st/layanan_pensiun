# Runbook persiapan produksi

Mulai dari `STATUS.md` dan `SOP.md`. Perintah berikut untuk **salinan arsip di folder privat operator**, bukan shared/data live. Gunakan Python 3.12 dan Node versi `.node-version`.

## Inventory dan kandidat

```bash
umask 077
python3 ops/production.py inventory --database /path/arsip-uat.sqlite
python3 ops/production.py plan --database /path/arsip-uat.sqlite --policy /path/policy.private.json --output /path/plan.json
python3 ops/production.py prepare --database /path/arsip-uat.sqlite --plan /path/plan.json --output-dir /path/calon-produksi-baru
python3 ops/production.py verify --database /path/calon-produksi-baru/production.sqlite
```

Template policy; isi dengan selector tepat yang dikonfirmasi pemilik, simpan600 di folder700:

```json
{
  "primary_superadmin_email": "superadmin@example.invalid",
  "ceo_email": "ceo@example.invalid",
  "agung_email": "agung@example.invalid",
  "extra_keep_emails": []
}
```

Plan menampilkan semua akun, usulan aktif/role, kelompok bisnis yang akan kosong dan dependensi manager. Seluruh admin_ops/admin_branch wajib masuk daftar terlindungi. CEO menjadi super_admin/all_bank. Role/cabang/bank Agung tetap. Source berubah setelah plan dibuat menyebabkan prepare ditolak. Folder keluaran harus baru.

Hasil prepare: `production.sqlite`, `plan.json`, `result.json` dan `credentials.private.json`. Tiga berkas pertama untuk pemeriksaan operator; kredensial hanya untuk penyerahan privat. Hasil CLI tidak mencetak password. Prepare tidak memasang database di server, tidak menjalankan PM2 dan tidak menghapus arsip.

Jika email tidak ditemukan, periksa inventory dan koreksi selector dengan pemilik; tidak ada pencocokan sebagian nama. Jika ada data nyata dalam arsip UAT, hentikan rencana mengosongkan semua koleksi dan tentukan data yang harus dipindahkan.

## Pemeriksaan server dan backup

Skrip serta unit backup dipasang root-owned setelah review. Backup berjalan dengan SQLite worker lpapp dan hasil disimpan root700/600. Pengujian lokal bukan bukti timer/HTTPS/reboot aktual pada VPS. Catat hasil server dan tujuan offsite sebelum menyatakan siap.

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

GPG meminta passphrase dua kali tanpa menampilkan ketikan. Gunakan passphrase panjang yang unik dan simpan di pengelola kata sandi, terpisah dari file backup. Jangan masukkan passphrase ke argumen perintah/chat. Skrip mengambil snapshot terbaru yang sudah lolos checksum dan berumur maksimal 90 menit, mengenkripsi AES256 di folder root privat, lalu menyerahkan **file terenkripsi saja** ke `~/lp-backup-downloads/` milik operator. Ia menampilkan path, SHA256 file terenkripsi dan SHA256 database untuk uji pemulihan. Tidak ada password aplikasi atau dokumen dicetak.

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

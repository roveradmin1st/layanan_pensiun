# SOP Kerja Layanan Pensiunan — v1.0

Tanggal: **5 November 2026, WIB**. Pemilik keputusan: pemilik sistem/pengguna. Tujuan: perubahan mudah ditelusuri, pengujian dapat diulang, deployment terkendali, serta pemulihan yang menjaga data.

Dokumen ini adalah standar kerja yang disusun untuk proyek saat ini. Otomasi CI/CD, jadwal backup, branch protection, dan seluruh kontrol yang disebut sebagai target **belum dianggap terpasang**. Eksekusi pada VPS ditunda selama review klien. Penulisan SOP tidak mengubah kode aplikasi, GitHub, akun, atau VPS.

Prinsip utama: **laptop untuk mengembangkan → GitHub untuk menyimpan dan meninjau versi → lingkungan uji untuk memvalidasi → VPS untuk menjalankan rilis yang disetujui.** Kode, konfigurasi, dan database dikelola terpisah.

**1. Catatan keadaan saat SOP dibuat**

| Komponen | Keadaan yang diketahui |
|---|---|
| Situs review | `https://139.190.106.136/`; pengguna sudah mengonfirmasi halaman dan login berhasil |
| Tujuan situs sekarang | Demo/UAT dengan database baru dan data contoh; belum produksi dengan data nasabah asli |
| Versi yang dipasang | `c693d42422dae82b033a74e632d5f0911540427c`, branch `fix/security-and-operational-integrity`, berdasarkan pemeriksaan clone dan pemasangan yang dipandu |
| GitHub `main` | Terakhir diperiksa berada pada `52ac0b883d903bca2dd35c3dd3ca43a8243d662f`; belum memuat kandidat yang dipasang. Periksa lagi saat pekerjaan dilanjutkan |
| Kode laptop | Branch, SHA, dan perubahan yang belum di-commit belum diverifikasi. Tidak otomatis dianggap sama dengan VPS |
| Runtime VPS | Ubuntu24.04, Node24.22.2, 2vCPU, RAM2GB, swap2GB, disk60GB |
| Backend | PM2 `layanan-pensiunan-api`, user `lpapp`, satu instance fork, listener `127.0.0.1:4000` telah diperlihatkan |
| HTTPS | Sertifikat IP, simulasi renewal dan timer pernah berhasil; renewal produksi berikutnya tetap perlu dipantau |
| Akun | Akun dan password demo dipertahankan atas keputusan pengguna untuk review sementara; risiko akses oleh pihak yang mengetahui kredensial demo masih ada |
| Startup setelah reboot | Perintah `pm2 save` dan startup sudah diberikan; pelaksanaan dan uji reboot belum dikonfirmasi |
| Backup/restore VPS | Jadwal, salinan di luar VPS, dan latihan restore belum dikonfirmasi. Utility snapshot baru diuji di lingkungan cloud |

Keberhasilan login bukan bukti seluruh proses bisnis, keamanan, backup, dan ketahanan restart sudah lulus. Catatan ini menggantikan informasi status deployment yang lebih lama dalam panduan persiapan; laporan audit lama tetap menjadi rekaman pengujian pada saat dibuat.

**2. Pembagian lingkungan dan sumber acuan**

| Tempat | Fungsi | Data dan konfigurasi |
|---|---|---|
| Laptop | Menulis kode, menjalankan tes, membuat commit | Database pengembangan sendiri; konfigurasi lokal sendiri |
| GitHub | Riwayat kode, PR, hasil CI, tag dan catatan rilis | Kode serta contoh konfigurasi tanpa secret; database tidak masuk Git |
| CI/lingkungan uji sementara | Memvalidasi kandidat dengan server dan database yang dapat dibuang | Data sintetis dan secret khusus pengujian |
| VPS UAT saat ini | Review klien terhadap rilis tertentu | Database demo VPS, terpisah dari database laptop |
| Produksi operasional nanti | Menjalankan versi yang diterima untuk data nyata | Database operasional menjadi sumber utama transaksi |

Saat kode laptop diperbaiki, VPS tidak otomatis berubah. Saat klien mengisi data di VPS, database laptop tidak otomatis berubah. **Deployment kode tidak boleh sekaligus menimpa database tanpa rencana migrasi yang disetujui.**

Untuk kapasitas sekarang, lingkungan uji dapat hidup sementara di CI atau di port loopback terpisah. Jika memakai VPS yang sama, gunakan database, secret dan profil browser terpisah, serta jalankan hanya saat kapasitas cukup. Cookies tidak dibedakan berdasarkan nomor port; profil browser terpisah menghindari sesi UAT dan staging saling mengganggu. Jangan menjalankan dua backend dengan database bersama karena aplikasi mempunyai cache state per proses.

**3. Wewenang dan cara berkomunikasi**

- Pemilik sistem menetapkan prioritas, menyetujui ruang lingkup perubahan, rilis, dan keputusan yang berpotensi menghilangkan data. Klien memberi hasil UAT dan menerima perilaku bisnis.
- Developer mengerjakan perubahan dan bukti pengujian. Operator memasang rilis dan menyiapkan pemulihan. Satu orang boleh memegang beberapa peran; checklist dan catatan tetap diperlukan.
- Sesuai permintaan pengguna, usulan perubahan kode disampaikan sebelum pengeditan. Jelaskan masalah, file/komponen yang terdampak, hasil yang diharapkan, dan cara menguji.
- Persetujuan dicatat beserta cakupannya: edit, commit/push, merge, dan deploy. Jangan menganggap izin audit sekaligus izin untuk semua tahap tersebut.
- Bila satu instruksi sudah mengizinkan beberapa tahap, lanjutkan dalam cakupan itu tanpa meminta izin berulang untuk setiap perintah rutin. Minta keputusan baru hanya ketika cakupan atau dampaknya berubah.
- Audit, diagnosis baca-saja, dan penulisan dokumen dapat dilakukan dalam task yang sudah diminta. Selama jeda review ini, perubahan runtime, pergantian rilis, akun, data, dan reboot menunggu kelanjutan pekerjaan dari pemilik sistem.
- Sebelum memberi perintah, selalu tulis **tujuan**, **lokasi terminal** (PowerShell laptop atau SSH VPS), **efek perubahan**, **hasil yang diharapkan**, dan **kapan harus berhenti**. Untuk pengguna yang mengeksekusi manual, berikan satu tahap yang bisa diverifikasi sebelum tahap berikutnya.

**4. Standar Git dan penyamaan versi**

Gunakan `main` sebagai baseline rilis setelah baseline yang sekarang berbeda sudah diselaraskan. Setiap pekerjaan memakai branch singkat, misalnya `fix/uat-012-login-mobile` atau `feat/uat-018-filter-leads`. Satu branch/PR menangani satu masalah yang jelas; perubahan UI kecil tidak digabung dengan refaktor autentikasi yang tidak berkaitan.

Urutan penyelarasan pertama setelah review:

1. Catat SHA rilis VPS dan keadaan kerja laptop, termasuk perubahan yang belum di-commit. Amankan pekerjaan lokal sebelum berpindah branch.
2. Ambil informasi GitHub terbaru, lalu bandingkan laptop, `main`, dan branch perbaikan. Jangan berasumsi `main` adalah versi live.
3. Tinjau perubahan branch perbaikan melalui PR menuju `main`, selesaikan konflik dengan membaca perubahan kedua sisi, dan jalankan tes pada hasil akhirnya.
4. Merge setelah ruang lingkup dan hasilnya diterima. Jika merge menghasilkan SHA baru, catat SHA tersebut dan bangun kandidat baru dari sana.
5. Rilis berikutnya berasal dari SHA pasti. Nama seperti `v0.1.0-uat.1` adalah contoh tag; belum ada klaim tag tersebut sudah dibuat.

Target aturan GitHub: PR sebelum merge ke `main`, pemeriksaan CI wajib, serta proteksi penghapusan dan force-push pada branch utama. Untuk pengembang tunggal, review diff dan checklist tetap dilakukan secara eksplisit. Tag rilis yang sudah dipakai tidak dipindahkan ke commit lain.

Jangan memasukkan `.env`, private key, token, SQLite/WAL/SHM, dokumen nasabah, log, atau `node_modules` ke Git. Secret yang terlanjur masuk riwayat perlu dicabut/diganti; menghapus file pada commit baru saja tidak mencabut secret.

**5. Siklus kerja harian**

1. Pilih satu temuan/tugas yang sudah disetujui. Tetapkan hasil yang dapat diamati dan cara membuktikannya.
2. Periksa working tree; jangan menimpa perubahan yang belum tersimpan. Sinkronkan baseline yang benar lalu buat branch tugas.
3. Reproduksi masalah pada data sintetis. Catat hasil sebelum perbaikan, terutama untuk bug yang akan memerlukan regresi.
4. Buat perubahan sekecil yang menyelesaikan masalah. Pisahkan refaktor atau pembaruan dependency yang memperluas risiko.
5. Jalankan pemeriksaan relevan. Tambahkan tes bermakna untuk bug/perilaku yang rawan berulang; perubahan teks/tampilan kecil cukup diverifikasi sesuai dampaknya.
6. Baca diff sendiri, periksa file tambahan dan secret, lalu buat commit dengan tujuan jelas, misalnya `fix(auth): reject inactive users during login`.
7. Ajukan PR dan bukti pengujian. Push, merge, dan deployment mengikuti cakupan persetujuan yang tercatat.
8. Setelah diterima dan dipasang, catat rilis dan hasil UAT. Tutup tugas setelah perilaku yang diminta terbukti, bukan setelah kode selesai ditulis.

Tidak perlu `npm ci` ulang setiap kali mengganti satu file sumber jika dependency valid dan lockfile tidak berubah. Gunakan `npm ci` untuk checkout bersih, CI, atau perubahan lockfile. Peningkatan dependency memakai PR tersendiri bila dampaknya berbeda; jangan menjalankan `npm audit fix --force` pada rilis aktif.

**6. Pengujian dan target CI**

| Pemeriksaan | Ketentuan proyek ini |
|---|---|
| Instalasi | `npm ci` berdasarkan lockfile yang di-commit; Node/npm pada CI dan runtime dipatok serta dicatat |
| Backend | `cd backend` lalu `npm test`; baseline kandidat saat ini 19 tes lulus. Jumlah dapat bertambah, tetapi tes tidak boleh diam-diam hilang |
| Frontend | `cd frontend` lalu `npm ci --include=dev` dan `npm run build` pada runner build |
| API/keamanan | Jalankan `backend/tests/security-and-api.test.mjs` secara eksplisit dengan `API_BASE_URL` menuju server sekali pakai |
| Produksi | Periksa startup dengan konfigurasi production dan secret pengujian yang benar; secret contoh/lemah ditolak; quick-role tetap ditutup |
| Bisnis dan akses | Role/cabang/bank, kalkulator, perubahan parameter, alur pengajuan/klaim, serta unggah/unduh sesuai perubahan |
| Browser | Login/logout, sesi setelah refresh, HP/desktop, asal API yang benar, gate/PWA, dan versi aset |
| Dependency | Baca advisory dan jalur yang terdampak; catat keputusan. Jangan menganggap build berhasil berarti seluruh dependency aman |

**Suite keamanan HTTP belum termasuk `npm test` dan melakukan perubahan serta restore state. Suite tersebut dilarang diarahkan ke database yang sedang dipakai klien.** Beberapa pemeriksaannya mengasumsikan mode development; verifikasi production dibuat terpisah dengan konfigurasi yang tepat. Jangan mengganti assertion agar suite hanya tampak lulus.

CI yang ditargetkan: install → tes → suite API terisolasi → build → paket dan checksum. Semua proses pengujian ditutup setelah selesai. Kontrol CI ini perlu diimplementasikan melalui perubahan repository yang disetujui; SOP tidak menyatakan workflow tersebut sudah tersedia.

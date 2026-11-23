# Checklist pemilik sebelum operasional Senin, 9 November 2026

Dokumen ini adalah lembar keputusan. Simpan identitas akun sebenarnya, roster, kata sandi sementara dan lokasi backup dalam catatan privat; jangan masukkan ke Git. Patch persiapan ini belum otomatis aktif pada VPS.

## Siapa yang bertugas

- Pemilik/PIC operasional: memutuskan roster, menandai data UAT versus data nyata, menyetujui acuan perhitungan dan waktu pembukaan.
- Operator teknis: mencatat commit aktif, membuat/menguji backup, menyiapkan kandidat dan menjalankan pergantian saat maintenance.
- Admin Operasional/Admin Cabang: uji alur per cabang, dokumen satu per satu dan klaim sampai bukti pembayaran.

Satu orang dapat memegang beberapa tugas pada tahap awal, tetapi setiap hasil tetap dicatat.

## Keputusan yang sudah ditetapkan

| Kelompok | Tindakan pada calon produksi |
|---|---|
| Super Admin utama | Pertahankan akun dan hak penuh |
| CEO | Pertahankan; super_admin dan seluruh bank |
| Agung Pambudi | Aktifkan kembali sebagai Sales Manager; pertahankan cabang dan cakupan saat ini |
| Seluruh Admin Operasional dan Admin Cabang | Pertahankan semuanya; bukan batas lima akun |
| Akun lain | Usulkan nonaktif, bukan hapus; tampilkan dalam plan untuk ditinjau |
| Master/parameter bank kustom | Pertahankan; bandingkan checksum/isi sebelum dan sesudah |
| Data bisnis UAT dan dokumen contoh | Kosongkan hanya dalam kandidat baru setelah dipastikan bukan data nyata |
| Password | Sementara acak, serahkan privat; ganti pribadi saat pertama masuk |
| Klaim | APPROVED dahulu; PAID setelah transfer nyata dan bukti valid |
| Backup luar VPS | Terenkripsi, simpan di laptop pemilik dahulu |

Akun terlindungi yang sebelumnya nonaktif tetap nonaktif, kecuali Agung yang reaktivasinya telah disetujui pemilik. Reaktivasi harus tercantum eksplisit dalam policy/plan. Jangan menebak email dari nama. Jika Marketing terlindungi masih bergantung pada SM yang akan nonaktif, tinjau dependensinya terlebih dahulu.

## Syarat membuka operasional

- [ ] Inventory server dan akun sesuai kondisi aktual; commit aktif dicatat.
- [ ] Arsip UAT terbaru konsisten, checksum cocok, terenkripsi dan benar-benar sudah diunduh ke laptop.
- [ ] File dari laptop berhasil didekripsi dan dipulihkan di lokasi uji; database/dokumen cocok.
- [ ] Roster tepat, semua admin ada, CEO berhak penuh, role Agung tetap; usulan nonaktif disetujui.
- [ ] Seluruh data yang akan kosong sudah dipastikan UAT; data nyata yang telanjur masuk sudah dipisahkan atau dimigrasikan.
- [ ] Kandidat mempertahankan master/parameter, kosong dari data demo, dan restart dua kali tidak menambahkan demo.
- [ ] Hasil PP3/PP10/PENSIUN dan bank yang akan dipakai cocok dengan contoh yang disetujui klien. Tes kode bukan pengesahan rumus bank.
- [ ] Admin menerima/menolak berkas satu per satu; unggah ulang perlu review ulang; tanpa berkas lengkap tidak bisa diteruskan.
- [ ] Klaim APPROVED tidak mencatat pembayaran; bukti transfer wajib untuk PAID dan pembayaran ulang ditolak.
- [ ] HTTPS dipercaya browser, pembaruan sertifikat dan backup otomatis aktif; backend hanya loopback; kapasitas cukup.
- [ ] Satu backend fork, daftar startup tersimpan dan uji reboot terjadwal berhasil.
- [ ] Commit/paket/database/config yang akan dipasang serta pasangan pemulihannya dicatat; jadwal maintenance diumumkan pemilik.
- [ ] Persetujuan aktivasi mengacu checksum plan/kandidat terbaru, bukan sekadar nama folder atau pesan “berhasil”.

Jika syarat wajib belum terpenuhi, lanjutkan pelatihan dengan data uji dan tunda input data nasabah nyata. Jangan membersihkan live agar sebuah pemeriksaan berubah hijau.

## Senin dan pemantauan awal

Sebelum pengguna masuk, operator menjalankan doctor, memeriksa backup serta TLS, lalu Admin Operasional memeriksa jumlah akun dan data awal. Pengguna mengganti password pribadi dan mencoba satu alur lengkap yang ditandai sebagai uji; record uji tidak boleh tercampur dengan klaim pembayaran nyata.

Pendampingan hari pertama: catat waktu, peran/cabang, langkah, pesan error dan nomor referensi. Kirim screenshot yang sudah menutupi identitas/dokumen nasabah; jangan kirim password/token. Jika ada dugaan data salah, hentikan input terkait, simpan bukti dan snapshot terbaru, lalu operator menilai perbaikan. Jangan reinstall, reset atau restore langsung.

Setiap sore: cocokkan jumlah pengajuan/klaim dengan catatan operasional, ekspor backup terenkripsi ke laptop dan verifikasi checksum. Tinjau ruang disk, kegagalan backup dan masa berlaku TLS. Usulan fitur baru masuk branch berikutnya setelah masa stabilisasi.

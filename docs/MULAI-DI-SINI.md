# Mulai dari sini — persiapan Senin, 9 November 2026

Tujuan: mengubah aplikasi UAT menjadi aplikasi operasional dengan data nyata, sambil mempertahankan akun yang ditentukan dan menyediakan jalan pemulihan. Kode persiapan sudah diuji di workspace pengembangan. Kode tersebut belum otomatis aktif di GitHub/VPS.

## Langkah pertama di terminal Antigravity yang terhubung ke VPS

Salin satu blok berikut. Ini **hanya membaca** lokasi rilis, jumlah data dan daftar akun. Tidak mengganti password, menghentikan aplikasi atau membersihkan database. Email/ID akun diperlukan agar akun yang dilindungi tidak salah pilih; hasil jangan dimasukkan ke repo publik.

```bash
readlink -f /srv/layanan-pensiunan/current
sudo -u lpapp -H python3 - <<'PY'
import json, sqlite3
from pathlib import Path
path = Path('/srv/layanan-pensiunan/shared/data/enterprise.sqlite').resolve(strict=True)
db = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
try:
    db.execute('BEGIN')
    state = json.loads(db.execute("SELECT payload FROM kv_store WHERE collection='enterprise_state'").fetchone()[0])
    print(json.dumps({
        'database': str(path),
        'jumlah': {k: len(state.get(k, [])) for k in ['users','leads','lead_requests','applications','simulations','claims']},
        'dokumen': db.execute('SELECT COUNT(*) FROM uploaded_files').fetchone()[0],
        'akun': [{k: u.get(k) for k in ['id','email','role','branch','bank_scope','active','manager_id']} for u in state['users']]
    }, indent=2, ensure_ascii=False))
finally:
    db.close()
PY
```

Periksa tiga email yang Anda konfirmasi, seluruh Admin Operasional dan Admin Cabang. Jika suatu email tidak ada, kita koreksi selector berdasarkan kondisi aktual; jangan langsung memilih akun dengan nama mirip. Jika perintah gagal, hentikan pada langkah ini dan catat pesan error tanpa password.

## Sesudah inventory

1. Buat backup SQLite terbaru, enkripsi dan unduh ke laptop. Uji pemulihan salinan dari laptop di lokasi terpisah.
2. Tinjau daftar akun yang dipertahankan/nonaktif serta data yang akan dikosongkan. Pastikan tidak ada data nasabah nyata yang ikut terhapus.
3. Dari backup, buat database calon produksi di folder baru. Live tetap berjalan untuk review sampai jadwal maintenance.
4. Review hasil kandidat dan commit aplikasi. Baru setelah disetujui, operator mengganti pasangan kode/database/config pada maintenance.
5. Verifikasi login pribadi, dokumen per berkas, klaim APPROVED→PAID, HTTPS, backup dan startup. Setelah seluruh syarat lulus, izinkan input data nyata.

Pegangan lengkap: [checklist pemilik](CHECKLIST-PEMILIK.md), [SOP kerja](SOP.md), [runbook teknis](RUNBOOK.md) dan [status/bukti tes](STATUS.md). Pertahankan arsip UAT untuk pemeriksaan; jangan menjalankan reset, restore browser atau menghapus folder live berdasarkan petunjuk UAT lama.

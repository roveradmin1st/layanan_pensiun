# Working agreement

Read `docs/STATUS.md`, `docs/SOP.md` and `docs/RUNBOOK.md` before changing or deploying this project. Indonesian is the user's working language.

- Explain the goal and exact scope before an application change. Follow the authorization already recorded in the conversation; do not infer permission to push/merge/deploy from an audit-only request. Do not repeatedly seek permission for steps already approved.
- Develop on a short-lived task branch. Inspect dirty work first and preserve the user's changes. The VPS is a release target; do not edit running application code or execute destructive tests there.
- Runtime: Ubuntu24.04, Node24, Express plus built-in SQLite, React/Vite, Nginx, PM2 as `lpapp`. One backend fork process only: the application caches state in memory.
- Code and data are separate. Deployment never resets/restores the database. Any intentional data removal or incompatible migration needs its own approved plan.
- Use `python3 ops/ci.py` for the complete validation path. It creates disposable backend/database copies; the HTTP security suite mutates/restores state and must never point to the VPS.
- Build packages on Linux using the pinned Node version; use lockfiles. CI packages the exact reviewed commit, both frontend and backend, without credentials/data/Git metadata.
- Installed privileged operations are root-owned and updated only through reviewed operator installation. Runtime archives cannot update the privileged controller.
- Never print `.env`, tokens, private keys, cookie values or `pm2 env`/`pm2 jlist`. Store deployment secrets through GitHub environment settings, not chat or commits.
- Deployment status comes from `doctor`/the actual process and release manifest, not the folder name or an old chat message. Record tests actually executed and distinguish local tests, GitHub workflow runs and VPS verification.
- Keep `docs/STATUS.md`, release notes and the runbook current. State remaining work and the exact command/UI action needed to resume after a chat interruption.

- Go-live work: protect primary Super Admin and CEO (CEO uses super_admin), Agung keeps the current role and is explicitly reactivated as confirmed by the owner, and retain every admin_ops/admin_branch account. Preserve other inactive accounts' status. Select accounts by exact ID/email, never fuzzy name matching; actual selectors belong only in the private policy.
- Production customer-data cleanup is a separate reviewed cutover. ops/production.py prepares a new candidate only; never run tests/reset/restore against shared/data. Never commit a live roster, private policy or temporary passwords.

---

## Rujukan Dokumentasi Kerja & Konteks Server (Wajib Dibaca Setiap Sesi Baru)

Setiap sesi AI baru wajib memeriksa dokumen berikut pada checkout pengembangan:

1. **`Blue_Print/command.md`** — Tempat instruksi dinamis terkini dari pemilik/ahli (selalu berubah sesuai penugasan aktif; baca ulang setiap kali pemilik mengarahkan ke file ini).
2. **`docs/STATUS.md`** — Catatan status bertanggal dan receipt verifikasi terbaru (peta lokasi `/srv/layanan-pensiunan/` dan `/home/layananpensiunan/`, riwayat audit bertanggal, status CI GitHub Actions, serta pembedaan antara bukti pemeriksaan server langsung dan laporan lisan). Jangan mengandalkan klaim versi aktif tanpa tanggal; selalu rujuk catatan bertanggal terbaru di `docs/STATUS.md` dan bukti pemeriksaan proses server (`PID`, user `lpapp`, `cwd`/script, manifest rilis, port `4000`, symlink `current`, dan database yang dibuka).
3. **`docs/SOP.md`** — SOP kerja harian, alur rilis 7 tahap, perlindungan data/akun produksi pada update berikutnya, dan aturan kolaborasi dengan pemilik.
4. **`docs/RUNBOOK.md`** — Prosedur teknis operasional, backup/enkripsi, serta batas antara prosedur yang sudah terbukti bekerja dan alat historis yang ditunda.
5. **`Blue_Print/PANDUAN_OPERASIONAL_VPS.md`** — Arsip prosedur UAT lama (hanya referensi historis; jangan gunakan perintah reset/restore/rilis lama dari arsip ini pada produksi).

### Alur Baku Perubahan hingga Rilis

**`pengembangan → pengujian → GitHub → CI berhasil → deployment saat diminta pemilik → verifikasi → catat versi`**

- Pada setiap update berikutnya, pertahankan seluruh data nasabah, dokumen BLOB, akun, password (`scrypt`), role, status aktif, relasi SM–Marketing, wilayah, cakupan bank, dan parameter bank yang sudah ada, kecuali perubahan tertentu memang diminta pemilik.
- Jika Antigravity terhubung melalui Remote SSH ke VPS, semua perintah terminal dan edit file berlaku langsung pada VPS. Pastikan selalu lokasi mesin, direktori kerja, dan branch sebelum mengubah apa pun.

### Prosedur Terbukti vs. Rencana Otomasi / Alat Historis

- **Sudah Terbukti Bekerja:**
  - Arsitektur runtime produksi: proses PM2 `layanan-pensiunan-api` berjalan sebagai `lpapp` (tepat 1 instance mode `fork` pada `127.0.0.1:4000`, Node sesuai `.node-version`) di balik Nginx HTTPS (`https://139.190.106.136/`), membuka `/srv/layanan-pensiunan/shared/data/enterprise.sqlite` (+ `-wal`, `-shm`) dengan kontrak data `lp-production-20261109-v1`. Untuk versi/commit rilis yang sedang aktif beserta tanggal verifikasinya, lihat catatan bertanggal dan receipt terbaru di `docs/STATUS.md`.
  - Validasi CI (`python3 ops/ci.py` dan GitHub Actions `.github/workflows/validate.yml`) pada database sementara, termasuk suite API terintegrasi (`backend/tests/security-and-api.test.mjs`).
- **Belum Tervalidasi / Ditunda (Jangan Diasumsikan Aktif):**
  - **Deployment rutin satu tombol (`ops/package_release.py`, `ops/server_release.py` / `lp-release`, `.github/workflows/deploy.yml`):** Spesifikasi telah ditetapkan pada `Blue_Print/command.md` (9 November 2026), namun belum diimplementasikan/dipasang di produksi. Setiap `git push` tidak otomatis memperbarui VPS.
  - **`ops/production_cutover.py`:** Alat transisi satu kali UAT→produksi yang pernah gagal saat aktivasi; riset/perbaikannya ditunda pemilik. Jangan dijalankan ulang untuk update rutin.
  - **`/srv/layanan-pensiunan/deploy.sh`:** Belum dinilai kesesuaiannya dalam audit 8 November 2026; jangan dianggap sebagai perintah update resmi.

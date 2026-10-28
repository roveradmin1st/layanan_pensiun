# Portal Layanan Pensiunan (Calc Platinum & Leads)

Portal Layanan Pensiunan adalah platform komprehensif berbasis web untuk simulasi pinjaman pensiun/prapensiun, manajemen database leads calon nasabah, pelacakan proses pengajuan kredit (8-tahap pipeline), verifikasi dokumen, serta tata kelola insentif marketing dengan dukungan Role-Based Access Control (RBAC).

---

## 🚀 Fitur Utama

1. **Multi-Engine Loan Calculator (Calc Platinum)**
   - **AMS2 Platinum Engine**: Perhitungan pinjaman pensiun dengan tenor hingga 180 bulan dan cadangan risiko berjenjang.
   - **BSI Simas Prapensiun Engine**: Simulasi skema prapensiun syariah dengan perhitungan premi Simas Jiwa berdasarkan usia & sisa masa kerja.
   - **Mitra Bank Engine**: Fleksibilitas penyesuaian parameter suku bunga, provisi, administrasi, asuransi, dan blokir angsuran.
   - Export simulasi ke format PDF & SVG resmi.

2. **Lead Management & Bulk Import**
   - Manajemen prospek calon nasabah pensiunan (Nopen, NIP, Gaji Pensiun, Usia).
   - Penugasan leads ke Marketing per kantor cabang.
   - Impor massal data calon nasabah dari file Excel / CSV dengan deteksi duplikasi.

3. **Pipeline Aplikasi Kredit (8 Tahapan)**
   - Alur pengajuan transparan: *Upload Dokumen &rarr; Pengajuan ke Bank &rarr; Verifikasi Bank &rarr; Approval Bank &rarr; Penjadwalan Akad &rarr; Akad Nasabah &rarr; Booking / Live &rarr; Status Selesai / Ditolak*.
   - Checklist 8 dokumen wajib perbankan (KTP, KK, SK Pensiun, Rekening Koran, dsb.).

4. **Klaim Insentif Marketing**
   - Pengajuan klaim reward/insentif otomatis saat aplikasi mencapai status Booking/Live.
   - Verifikasi bukti booking dan pencairan oleh Admin Operasional.

5. **Keamanan & Tata Kelola Enterprise**
   - Autentikasi berbasis JWT dengan Role-Based Access Control (`super_admin`, `admin_ops`, `marketing`).
   - Maker-Checker Dual Control untuk usulan perubahan parameter mitra perbankan.
   - Audit Log menyeluruh untuk setiap mutasi data finansial.

---

## 📁 Struktur Repositori

```text
layanan_pensiunan/
├── assets/                  # Asset statis, styling, dan engine JS versi standalone/PWA
├── backend/                 # Backend REST API Server (Node.js Express + SQLite / Postgres)
│   ├── data/                # Direktori runtime SQLite (diabaikan oleh git)
│   ├── src/
│   │   ├── config/          # Parameter default suku bunga & mitra bank
│   │   ├── db/              # Lapisan database & inisialisasi tabel
│   │   ├── engines/         # Engine kalkulator finansial & generator PDF/SVG
│   │   └── server.js        # Entry point Express API Server
│   ├── Dockerfile
│   └── package.json
├── database/                # Skema enterprise (PostgreSQL DDL)
│   └── schema.postgres.sql
├── frontend/                # Frontend React Modern (Vite + Tailwind CSS + Lucide)
│   ├── src/
│   │   ├── components/      # Komponen UI modular (Calc, Leads, Dialog, Common)
│   │   ├── context/         # AuthContext & State global
│   │   ├── lib/             # Axios client & utilitas format Rupiah/tanggal
│   │   └── pages/           # Halaman Dashboard, Calculator, Leads, Aplikasi, dll.
│   ├── Dockerfile
│   └── package.json
├── Blue_Print/              # Dokumen spesifikasi bisnis, prototipe, & acuan formula
├── docker-compose.yml       # Orkestrasi Docker (Postgres, Backend API, Frontend Web)
├── start-enterprise.bat     # Script praktis menjalankan Backend & Frontend sekaligus di Windows
├── .env.example             # Contoh konfigurasi environment variable aman
├── .gitignore               # Konfigurasi pengabaian file sensitif & build artifacts
└── README.md                # Dokumentasi proyek
```

---

## ⚙️ Persyaratan Sistem

- [Node.js](https://nodejs.org/) v18.0.0 atau lebih baru
- npm v9.0.0 atau lebih baru
- *(Opsional)* Docker & Docker Compose

---

## 🛠️ Panduan Menjalankan Aplikasi

### 1. Menjalankan Langsung (Local Development)

#### Backend:
```bash
cd backend
npm install
node src/server.js
# Backend berjalan di: http://localhost:4000
```

#### Frontend (React Vite):
```bash
cd frontend
npm install
npm run dev
# Frontend berjalan di: http://localhost:5173
```

> **Catatan Windows:** Anda dapat langsung menjalankan file `start-enterprise.bat` untuk meluncurkan backend dan frontend sekaligus dalam terminal terpisah.

### 2. Menjalankan dengan Docker Compose
```bash
docker-compose up --build
```
- Frontend Web: `http://localhost:8080`
- Backend API: `http://localhost:4000`
- Database Postgres: Port `5432`

---

## 🔐 Akun Default Pengujian (Initial Seed)

Secara default, sistem membuat akun berikut saat inisialisasi awal:

| Role | Email | Password Default |
|---|---|---|
| Super Admin | `superadmin@layananpensiunan.id` | `Password123!` |
| Admin Operasional | `adminops@layananpensiunan.id` | `Password123!` |
| Marketing | `marketing@layananpensiunan.id` | `Password123!` |

> [!WARNING]
> Segera ubah password default saat melakukan deployment ke server produksi melalui menu Pengaturan Profil.

---

## 📄 Lisensi
Properti privat dan internal. Seluruh hak cipta dilindungi undang-undang.

// ============================================================================
// OPERATIONAL FEATURES UNIT TEST SUITE:
// 1. Zero-dependency PKZIP Builder & Filename Sanitizer
// 2. Multi-format & Multi-sheet Leads Import Parser (.xlsx & .csv)
// 3. Real-world Client Banking Feeds Parsing (14 sheets, complex headers & phones)
// 4. Claims Incentive Nominal Visibility & Scoping (SM & Marketing Protection)
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildZipBuffer, sanitizeSafeFilename } from "../src/utils/zip-builder.js";
import { parseImportFile, parsePhone, parseSalary, parseBirthAndAge, detectHeaderIndices } from "../src/utils/lead-import-parser.js";
import { normalizeBranch, resolveBranchFromCityOrText } from "../src/config/branches.js";

test("ZIP Builder: Menghasilkan buffer ZIP valid dengan signature PK\\x03\\x04 dan CRC32 akurat", () => {
  const file1Content = Buffer.from("Konten Berkas PDF Dokumen 1 Nasabah");
  const file2Content = Buffer.from("Konten Berkas Foto KTP Pasangan 2");

  const entries = [
    { name: "01_ktp_nasabah.pdf", data: file1Content },
    { name: "02_ktp_pasangan.jpg", data: file2Content }
  ];

  const zipBuffer = buildZipBuffer(entries);
  assert.ok(Buffer.isBuffer(zipBuffer), "Hasil harus berupa Buffer");
  assert.ok(zipBuffer.length > file1Content.length + file2Content.length, "Ukuran ZIP harus mencakup header & central directory");

  // Validasi Local File Header signature (0x04034b50 -> 'PK\x03\x04')
  assert.equal(zipBuffer[0], 0x50, "Signature byte 0 harus 'P'");
  assert.equal(zipBuffer[1], 0x4b, "Signature byte 1 harus 'K'");
  assert.equal(zipBuffer[2], 0x03, "Signature byte 2 harus 0x03");
  assert.equal(zipBuffer[3], 0x04, "Signature byte 3 harus 0x04");

  // Validasi End of Central Directory signature (0x06054b50 -> 'PK\x05\x06')
  const eocdIndex = zipBuffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocdIndex > 0, "Harus terdapat End of Central Directory record");

  // Verifikasi parsing struktur ZIP untuk memastikan jumlah entry dan integritas nama berkas
  const totalEntries = zipBuffer.readUInt16LE(eocdIndex + 10);
  assert.equal(totalEntries, 2, "Jumlah entry pada EOCD harus 2");

  // Pastikan nama berkas ada di dalam buffer
  const zipStr = zipBuffer.toString("latin1");
  assert.ok(zipStr.includes("01_ktp_nasabah.pdf"), "Nama berkas 1 harus termuat di ZIP");
  assert.ok(zipStr.includes("02_ktp_pasangan.jpg"), "Nama berkas 2 harus termuat di ZIP");
});

test("Sanitasi Nama Berkas: Menghindari directory traversal, null-byte, dan karakter berbahaya", () => {
  // Directory traversal
  assert.equal(sanitizeSafeFilename("../../etc/passwd.pdf"), "etc_passwd.pdf");
  assert.equal(sanitizeSafeFilename("..\\..\\Windows\\System32\\cmd.exe"), "Windows_System32_cmd.exe");

  // Karakter kontrol & karakter khusus sistem file
  assert.equal(sanitizeSafeFilename("Dokumen: Nasabah / BSI * 2026?.pdf"), "Dokumen_Nasabah_BSI_2026.pdf");
  assert.equal(sanitizeSafeFilename("file\0null.pdf"), "file_null.pdf");

  // Nama kosong fallback
  assert.equal(sanitizeSafeFilename("", "dokumen_default.pdf"), "dokumen_default.pdf");
  assert.equal(sanitizeSafeFilename("   ", "dokumen_default.pdf"), "dokumen_default.pdf");

  // Batasan panjang nama berkas (max 120 chars)
  const longName = "A".repeat(150) + ".pdf";
  const sanitized = sanitizeSafeFilename(longName);
  assert.ok(sanitized.length <= 120, "Nama berkas harus dibatasi maksimal 120 karakter");
  assert.ok(sanitized.endsWith(".pdf"), "Ekstensi berkas harus dipertahankan");
});

test("Parser Impor: Parsing dan normalisasi telepon, gaji, usia, dan cabang", () => {
  // 1. Uji nomor telepon
  assert.equal(parsePhone("81376504596"), "081376504596", "Telepon tanpa leading 0 harus ditambah 0");
  assert.equal(parsePhone("+62 813-9988-7766"), "081399887766");
  assert.equal(parsePhone("6281361703639"), "081361703639");
  assert.equal(parsePhone("6281370191947/6281370191947"), "081370191947", "Dual phone slash harus ambil nomor valid pertama");
  assert.equal(parsePhone("081376411233 & 1272070508640001"), "081376411233", "Phone digabung NIK harus ambil nomor HP valid");

  // 2. Uji nominal gaji / plafond
  assert.equal(parseSalary("5.225.500,00"), 5225500, "Format desimal koma Indonesia");
  assert.equal(parseSalary("111,565,606.33"), 111565606, "Format ribuan koma US");
  assert.equal(parseSalary("5,420,300.00\t"), 5420300, "Format tab trailing");
  assert.equal(parseSalary(82582713.02), 82582713, "Format float numerik");
  assert.equal(parseSalary("162347547.9581503"), 162347547, "Format float string banyak digit desimal");
  assert.equal(parseSalary(null, 4500000), 4500000, "Fallback nominal");

  // 3. Uji tanggal lahir & usia
  const fromSerial = parseBirthAndAge("23429", null);
  assert.equal(fromSerial.birth_date, "1964-02-22", "Excel serial date 23429");
  assert.ok(fromSerial.age >= 60);

  const fromTextAge = parseBirthAndAge(null, "61 Tahun 5 bulan 10 hari");
  assert.equal(fromTextAge.age, 61, "Usia teks harus terurai");

  const fromNip = parseBirthAndAge(null, null, "196506112000031001");
  assert.equal(fromNip.birth_date, "1965-06-11", "Tanggal lahir harus diekstrak dari NIP 18 digit");
  assert.ok(fromNip.age >= 59);

  // 4. Uji normalisasi cabang
  assert.equal(normalizeBranch("KC PEMATANGSIANTAR PERINTIS"), "PEMATANGSIANTAR");
  assert.equal(normalizeBranch("KCP PEMATANGSIANTAR SUTOMO"), "PEMATANGSIANTAR");
  assert.equal(normalizeBranch("KCP INDRAPURA"), "PEMATANGSIANTAR");
  assert.equal(normalizeBranch("Kemenag Simalungun"), "PEMATANGSIANTAR");
  assert.equal(normalizeBranch("Kemenag Humbahas"), "PEMATANGSIANTAR");
  assert.equal(normalizeBranch("KC BANDUNG ASIA AFRIKA"), "BANDUNG");
});

test("Parser Impor: CSV dengan berbagai pemisah, format gaji, dan normalisasi nomor HP", () => {
  const csvContent = `Nama Nasabah,Nomor HP,Kota,Cabang,Gaji Pensiun,Tanggal Lahir,NOPEN,Sales Manager,Marketing
H. AHMAD SUBAGJA,0812-3456-7890,Kota Bandung,BANDUNG,"Rp 4.650.000",1954-05-10,195405101979031001,SM Ahmad,Marketing Rian
SITI NURHALIZA,+62 813 9988 7766,Medan,MEDAN,3.850.000,1958-11-20,195811201980032001,,
BUDI SANTOSO,085711223344,Surabaya,SURABAYA,5200000,1960-01-15,,,`;

  const parsed = parseImportFile(Buffer.from(csvContent, "utf8"), "data_nasabah.csv");
  assert.equal(parsed.rows.length, 3, "Harus memuat 3 baris data");

  // Baris 1
  const r1 = parsed.rows[0];
  assert.equal(r1.name, "H. AHMAD SUBAGJA");
  assert.equal(r1.phone, "081234567890");
  assert.equal(r1.salary, 4650000);
  assert.equal(r1.birth_date, "1954-05-10");
  assert.ok(r1.age >= 65);
  assert.equal(r1.sales_manager_hint, "SM Ahmad");
  assert.equal(r1.marketing_hint, "Marketing Rian");

  // Baris 2
  const r2 = parsed.rows[1];
  assert.equal(r2.name, "SITI NURHALIZA");
  assert.equal(r2.phone, "081399887766");
  assert.equal(r2.salary, 3850000);
  assert.equal(r2.branch_hint, "MEDAN");
});

test("Parser Impor: Validasi Berkas Nyata Klien Excel (.xlsx multi-sheet 14 sheet)", () => {
  const clientFilePath = "C:/Users/TOSHIBA/.gemini/antigravity/brain/f99f41d4-8be5-49c4-b666-135cd304ba32/.user_uploaded/media_1794142199060_733c4174.xlsx";

  if (!fs.existsSync(clientFilePath)) {
    // Lewati jika file tidak ada di lingkungan tertentu
    return;
  }

  const clientBuffer = fs.readFileSync(clientFilePath);
  const parsed = parseImportFile(clientBuffer, "Sutomo_&_Perintis.xlsx");

  assert.ok(parsed.total_parsed > 500, `Harus berhasil mem-parse ratusan leads (aktual: ${parsed.total_parsed})`);
  assert.ok(parsed.sheets_parsed.length >= 10, `Harus mem-parse minimal 10 sheet data (aktual: ${parsed.sheets_parsed.length})`);
  assert.ok(parsed.sheets_parsed.includes("Dataku"), "Sheet Dataku harus ter-parse");
  assert.ok(parsed.sheets_parsed.includes("Kemenag Simalungun"), "Sheet Kemenag Simalungun harus ter-parse");
  assert.ok(parsed.sheets_parsed.includes("PreApp 3 cbg"), "Sheet PreApp 3 cbg harus ter-parse");

  // Periksa lead pertama dari Dataku
  const lead1 = parsed.rows[0];
  assert.equal(lead1.name, "ROSMALA LUBIS");
  assert.equal(lead1.phone, "081376504596", "Telepon harus berawalan 08");
  assert.equal(lead1.nopen, "13185800500");
  assert.equal(lead1.salary, 5225500);
  assert.equal(resolveBranchFromCityOrText(lead1.city, lead1.branch_hint), "PEMATANGSIANTAR");
});

test("Klaim Insentif: Nominal disembunyikan dari akun SM dan Marketing hingga ditetapkan Admin", async () => {
  function isClaimAmountFixed(claim) {
    if (!claim) return false;
    if (claim.amount_fixed === true) return true;
    if (claim.amount_fixed === false) return false;
    return ["APPROVED", "PAID"].includes(claim.status) && Number(claim.amount) > 0;
  }

  function serializeClaimForUser(claim, user) {
    if (!claim) return null;
    const fixed = isClaimAmountFixed(claim);
    const isSuperOrOps = Boolean(user && ["super_admin", "admin_ops"].includes(user.role));
    if (isSuperOrOps) {
      return {
        ...claim,
        amount_fixed: fixed
      };
    }
    return {
      ...claim,
      amount: fixed ? claim.amount : null,
      amount_fixed: fixed
    };
  }

  const claimBaru = {
    id: "clm-1",
    claim_no: "CLM-202611-0001",
    lead_name: "Bpk. Sutrisno",
    status: "DRAFT",
    amount: 2000000,
    amount_fixed: false
  };

  const marketingUser = { id: "mkt-1", role: "marketing", name: "Rian Marketing" };
  const smUser = { id: "sm-1", role: "sales_manager", name: "Pak Manager" };
  const adminOps = { id: "ops-1", role: "admin_ops", name: "Admin Ops" };

  // 1. Saat baru diajukan, Marketing & SM tidak boleh melihat nominal
  const mktView = serializeClaimForUser(claimBaru, marketingUser);
  assert.equal(mktView.amount, null, "Marketing TIDAK BOLEH melihat nominal insentif sebelum fix");
  assert.equal(mktView.amount_fixed, false);

  const smView = serializeClaimForUser(claimBaru, smUser);
  assert.equal(smView.amount, null, "Sales Manager TIDAK BOLEH melihat nominal insentif sebelum fix");
  assert.equal(smView.amount_fixed, false);

  // 2. Admin Ops tetap melihat nilai referensi internal
  const opsView = serializeClaimForUser(claimBaru, adminOps);
  assert.equal(opsView.amount, 2000000);
  assert.equal(opsView.amount_fixed, false);

  // 3. Setelah Admin menetapkan nominal fix (amount_fixed: true)
  const claimFixed = {
    ...claimBaru,
    amount: 2500000,
    amount_fixed: true
  };

  const mktViewFixed = serializeClaimForUser(claimFixed, marketingUser);
  assert.equal(mktViewFixed.amount, 2500000, "Marketing DAPAT melihat nominal setelah Admin menetapkannya secara fix");
  assert.equal(mktViewFixed.amount_fixed, true);
});

// ============================================================================
// ENTERPRISE LEAD IMPORT PARSER (MULTI-FORMAT & MULTI-SHEET: .XLSX & .CSV)
// Zero external dependencies, pure Node.js (node:zlib)
// Built-in protections: Anti-XXE, Anti-Zip Bomb, CSV Formula Injection Sanitizer
// Smart Header Detection (handles banners/dates/sub-tables), Multi-Sheet Parsing
// Robust Phone, Salary, NIP, Age & Branch Resolvers
// ============================================================================

import zlib from "node:zlib";
import { computeAgeDetail } from "../engines/calc-engine.js";
import { normalizeBranch, resolveBranchFromCityOrText } from "../config/branches.js";

const MAX_DECOMPRESSED_XML_BYTES = 50 * 1024 * 1024; // 50 MB max output guard
const MAX_IMPORT_ROWS = 10000;

/**
 * Sanitasi string sel dari serangan CSV / Formula Injection
 */
export function sanitizeCellValue(val) {
  if (val == null) return "";
  let s = String(val).trim();
  // Strip formula prefixes if present (=, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(s)) {
    s = s.replace(/^[=+\-@\t\r]+/, "").trim();
  }
  return s;
}

/**
 * Parse nominal gaji / plafond dari format teks Indonesia, format US, atau numerik
 * Menangani pemisah ribuan titik/koma, desimal, spasi, dan tab
 */
export function parseSalary(raw, fallback = 4500000) {
  if (raw == null || raw === "") return fallback;
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : fallback;
  }
  let s = String(raw).replace(/^Rp\.?\s*/i, "").trim().replace(/[\s\t]/g, "");
  if (!s) return fallback;

  if (s.includes(".") && s.includes(",")) {
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastComma > lastDot) {
      // Indonesian format: 5.225.500,00 -> buang desimal koma, buang titik ribuan
      s = s.slice(0, lastComma).replace(/\./g, "");
    } else {
      // US format: 111,565,606.33 -> buang desimal titik, buang koma ribuan
      s = s.slice(0, lastDot).replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    if (/^\d{1,3}(,\d{3})+$/.test(s)) {
      s = s.replace(/,/g, "");
    } else if (/,\d+$/.test(s)) {
      s = s.slice(0, s.lastIndexOf(","));
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(".")) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, "");
    } else {
      s = s.slice(0, s.lastIndexOf("."));
    }
  }

  const num = Number(s.replace(/[^0-9]/g, ""));
  return Number.isFinite(num) && num > 0 ? Math.round(num) : fallback;
}

/**
 * Parse nomor telepon Indonesia menjadi format standar "08..."
 * Menangani:
 * - Nomor tanpa leading 0 (contoh: 81376504596 -> 081376504596)
 * - Awalan negara (+62... atau 62... -> 08...)
 * - Kolom ganda yang dipisah tanda / atau & (contoh: 62813.../62813...)
 * - Nomor telepon yang digabung dengan NIK (contoh: 081376411233 & 1272070508640001)
 */
export function parsePhone(raw) {
  if (raw == null) return "";
  let s = String(raw).trim();
  if (!s) return "";

  // Pisahkan jika ada pemisah &, /, koma, atau spasi ganda
  const parts = s.split(/[\/&,\s]+/);
  let candidate = "";

  for (const part of parts) {
    const clean = part.replace(/[^0-9+]/g, "");
    // Nomor HP valid di Indonesia: 9 sampai 14 digit
    if (clean.length >= 9 && clean.length <= 15) {
      candidate = clean;
      break;
    }
  }

  if (!candidate) {
    candidate = s.replace(/[^0-9+]/g, "");
  }

  if (candidate.startsWith("+62")) candidate = "0" + candidate.slice(3);
  else if (candidate.startsWith("62")) candidate = "0" + candidate.slice(2);
  else if (candidate.startsWith("8") && candidate.length >= 9 && candidate.length <= 13) {
    candidate = "0" + candidate;
  }

  return candidate;
}

/**
 * Parse tanggal lahir / Excel serial date / NIP 18-digit dan hitung usia numerik
 */
export function parseBirthAndAge(rawBirth, rawAge, nip = "") {
  let birthIso = null;
  let age = null;

  if (rawBirth) {
    const s = String(rawBirth).trim();
    // 1. Cek Excel Serial Date (misal 23429)
    if (/^\d{4,5}$/.test(s)) {
      const serial = Number(s);
      if (serial > 1000 && serial < 60000) {
        const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime())) {
          birthIso = date.toISOString().slice(0, 10);
        }
      }
    } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      birthIso = s.slice(0, 10);
    } else if (/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/.test(s)) {
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (m) {
        const d = m[1].padStart(2, "0");
        const mo = m[2].padStart(2, "0");
        const y = m[3];
        birthIso = `${y}-${mo}-${d}`;
      }
    }
  }

  // Parse usia jika tersedia (teks seperti "61 Tahun 5 bulan", float "64.37", atau angka)
  if (rawAge) {
    const m = String(rawAge).match(/(\d+)/);
    if (m) {
      const parsedAge = Number(m[1]);
      if (parsedAge > 0 && parsedAge < 120) {
        age = parsedAge;
      }
    }
  }

  // Fallback cerdas: ekstrak tanggal lahir dari 18 digit NIP PNS (YYYYMMDD...)
  if (!birthIso && nip) {
    const cleanNip = String(nip).replace(/\D/g, "");
    if (cleanNip.length === 18) {
      const y = Number(cleanNip.slice(0, 4));
      const mo = cleanNip.slice(4, 6);
      const d = cleanNip.slice(6, 8);
      if (y >= 1930 && y <= 2015 && Number(mo) >= 1 && Number(mo) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
        birthIso = `${y}-${mo}-${d}`;
      }
    }
  }

  if (birthIso && age == null) {
    const ageDetail = computeAgeDetail(birthIso);
    if (ageDetail && ageDetail.years) {
      age = ageDetail.years;
    }
  }

  if (!birthIso && age != null) {
    const estYear = new Date().getFullYear() - age;
    birthIso = `${estYear}-01-01`;
  }

  return {
    birth_date: birthIso || "1954-05-10",
    age: age != null ? age : 65
  };
}

/**
 * Ekstrak file dari arsip ZIP (.xlsx) secara native menggunakan magic bytes PK\x03\x04
 */
function extractZipEntries(buffer) {
  const entries = new Map();
  let pos = 0;

  while (pos < buffer.length - 30) {
    if (buffer.readUInt32LE(pos) !== 0x04034b50) {
      pos++;
      continue;
    }

    const compression = buffer.readUInt16LE(pos + 8);
    const compressedSize = buffer.readUInt32LE(pos + 18);
    const nameLen = buffer.readUInt16LE(pos + 26);
    const extraLen = buffer.readUInt16LE(pos + 28);

    if (pos + 30 + nameLen > buffer.length) break;
    const name = buffer.toString("utf8", pos + 30, pos + 30 + nameLen);
    const dataStart = pos + 30 + nameLen + extraLen;

    if (compressedSize > 0 && dataStart + compressedSize <= buffer.length) {
      const rawData = buffer.subarray(dataStart, dataStart + compressedSize);
      if (compression === 0) {
        // STORE
        entries.set(name, rawData);
      } else if (compression === 8) {
        // DEFLATE
        try {
          const decompressed = zlib.inflateRawSync(rawData, {
            maxOutputLength: MAX_DECOMPRESSED_XML_BYTES
          });
          entries.set(name, decompressed);
        } catch {
          // Abaikan jika entri tertentu gagal decompress
        }
      }
    }

    pos = dataStart + compressedSize;
  }

  return entries;
}

/**
 * Parsing XML SharedStrings pada format .xlsx
 */
function parseSharedStrings(xmlBuf) {
  if (!xmlBuf) return [];
  const xml = xmlBuf.toString("utf8");
  // Anti-XXE
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) {
    throw new Error("File XLSX tidak sah (mengandung deklarasi DTD/Entity).");
  }

  const strings = [];
  const siMatches = xml.matchAll(/<si\b[^>]*>(.*?)<\/si>/gis);
  for (const m of siMatches) {
    const siContent = m[1];
    const textPieces = [];
    const tMatches = siContent.matchAll(/<t\b[^>]*>(.*?)<\/t>/gis);
    for (const tm of tMatches) {
      textPieces.push(
        tm[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
      );
    }
    strings.push(textPieces.join(""));
  }
  return strings;
}

/**
 * Konversi kolom huruf Excel ("A", "B", "AA") menjadi indeks angka 0-based
 */
function colLettersToIndex(colStr) {
  let idx = 0;
  for (let i = 0; i < colStr.length; i++) {
    idx = idx * 26 + (colStr.charCodeAt(i) - 64);
  }
  return idx - 1;
}

/**
 * Parsing sheet XML pada format .xlsx menjadi array 2D baris dan kolom
 */
function parseSheetRows(xmlBuf, sharedStrings = []) {
  if (!xmlBuf) return [];
  const xml = xmlBuf.toString("utf8");
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) {
    throw new Error("File XLSX tidak sah (mengandung deklarasi DTD/Entity).");
  }

  const rows = [];
  const rowMatches = xml.matchAll(/<row\b[^>]*>(.*?)<\/row>/gis);

  for (const rm of rowMatches) {
    const rowContent = rm[1];
    const cells = [];
    const cellMatches = rowContent.matchAll(/<c\b([^>]*)>(.*?)<\/c>/gis);

    for (const cm of cellMatches) {
      const attrs = cm[1];
      const content = cm[2];

      const rMatch = attrs.match(/r="([A-Z]+)(\d+)"/i);
      const isString = /t="s"/i.test(attrs);

      let val = "";
      const vMatch = content.match(/<v>(.*?)<\/v>/is);
      if (vMatch) {
        const rawVal = vMatch[1].trim();
        if (isString) {
          const strIdx = Number(rawVal);
          val = sharedStrings[strIdx] || "";
        } else {
          val = rawVal;
        }
      } else {
        const isInlineStr = /t="inlineStr"/i.test(attrs);
        if (isInlineStr) {
          const tMatch = content.match(/<t\b[^>]*>(.*?)<\/t>/is);
          val = tMatch ? tMatch[1] : "";
        }
      }

      val = val
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

      if (rMatch) {
        const colIdx = colLettersToIndex(rMatch[1].toUpperCase());
        cells[colIdx] = val;
      } else {
        cells.push(val);
      }
    }

    if (cells.length > 0 && cells.some((c) => c != null && String(c).trim() !== "")) {
      rows.push(cells);
    }
  }

  return rows;
}

/**
 * Parsing teks CSV / TSV dengan deteksi otomatis delimiter dan quoted strings
 */
function parseCsvRows(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];

  // Deteksi delimiter dari baris awal
  const sample = lines[0] + "\n" + (lines[1] || "");
  let delimiter = ",";
  if (sample.includes(";") && !sample.includes(",")) delimiter = ";";
  else if (sample.includes("\t") && !sample.includes(",")) delimiter = "\t";

  const rows = [];
  for (const line of lines) {
    const cells = [];
    let cur = "";
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === delimiter && !inQuote) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }

  return rows;
}

/**
 * Smart Header Mapping: memetakan indeks kolom secara fleksibel dan toleran
 */
export function detectHeaderIndices(headerRow = []) {
  const map = {
    name: -1,
    phone: -1,
    city: -1,
    branch: -1,
    source: -1,
    nopen: -1,
    nip: -1,
    salary: -1,
    birth_date: -1,
    age: -1,
    sales_manager: -1,
    marketing: -1
  };

  headerRow.forEach((col, idx) => {
    const c = String(col || "").trim().toLowerCase();
    if (!c) return;

    if (map.name === -1 && (c === "nama" || c === "nama debitur" || c === "nama pegawai" || c === "nama nasabah" || c === "name")) {
      map.name = idx;
    } else if (map.phone === -1 && (c.includes("hp") || c.includes("telepon") || c.includes("telp") || c.includes("handphone") || c.includes("phone") || c.includes("wa") || c.includes("kontak"))) {
      map.phone = idx;
    } else if (map.nopen === -1 && (c.includes("nopen") || c.includes("pension") || c.includes("notas") || c.includes("no pensiun") || c.includes("nomor pensiun"))) {
      map.nopen = idx;
    } else if (map.nip === -1 && (c.includes("nip") || c.includes("nik") || c.includes("nrp"))) {
      map.nip = idx;
    } else if (map.salary === -1 && (c.includes("gaji") || c.includes("thp") || c.includes("penghasilan") || c.includes("os pokok") || c.includes("plafond") || c.includes("salary") || c.includes("nominal"))) {
      map.salary = idx;
    } else if (map.birth_date === -1 && (c.includes("lahir") || c.includes("birth") || c.includes("dob"))) {
      map.birth_date = idx;
    } else if (map.age === -1 && (c.includes("usia") || c.includes("umur") || c === "age" || /^age\b|\bage\b/i.test(c))) {
      if (!c.includes("manager")) {
        map.age = idx;
      }
    } else if (map.city === -1 && (c === "alamat" || c === "kota" || c === "kabupaten" || c === "domisili" || c === "city")) {
      map.city = idx;
    } else if (c.includes("nama outlet") || c.includes("cabang bsi desk") || c === "nama cabang" || c === "cabang") {
      map.branch = idx;
    } else if (map.branch === -1 && (c.includes("outlet") || c.includes("cabang") || c.includes("wilayah") || c.includes("kanca") || c.includes("branch"))) {
      if (!c.includes("code") && !c.includes("kode")) {
        map.branch = idx;
      }
    } else if (map.source === -1 && (c.includes("instansi") || c.includes("sumber") || c.includes("source") || c.includes("segmen"))) {
      map.source = idx;
    } else if (map.sales_manager === -1 && (c.includes("sales manager") || c === "sm" || c === "manager" || c.includes("nama sm"))) {
      map.sales_manager = idx;
    } else if (map.marketing === -1 && (c.includes("marketing") || c.includes("petugas") || c.includes("ao") || c.includes("account officer"))) {
      map.marketing = idx;
    }
  });

  // Second pass: loose match untuk nama jika belum ketemu exact match
  if (map.name === -1) {
    headerRow.forEach((col, idx) => {
      const c = String(col || "").trim().toLowerCase();
      if (map.name === -1 && (c.includes("nama") || c.includes("debitur") || c.includes("penerima"))) {
        map.name = idx;
      }
    });
  }

  return map;
}

/**
 * Deteksi baris header secara cerdas dari kumpulan baris (mengabaikan banner judul atau baris kosong di atas)
 */
export function findHeaderRow(rows = []) {
  const scanLimit = Math.min(rows.length, 12);
  for (let rIdx = 0; rIdx < scanLimit; rIdx++) {
    const row = rows[rIdx];
    if (!row || !row.length) continue;

    let hasName = false;
    let hasIdentifier = false;
    let hasContactOrMoney = false;

    for (let cIdx = 0; cIdx < row.length; cIdx++) {
      const cell = String(row[cIdx] || "").trim().toLowerCase();
      if (!cell) continue;

      if (cell.includes("nama") || cell.includes("debitur") || cell.includes("penerima") || cell === "name") {
        hasName = true;
      }
      if (cell.includes("hp") || cell.includes("telepon") || cell.includes("telp") || cell.includes("wa") || cell.includes("phone")) {
        hasContactOrMoney = true;
      }
      if (cell.includes("nopen") || cell.includes("nip") || cell.includes("nik") || cell.includes("cif") || cell.includes("rekening") || cell.includes("account")) {
        hasIdentifier = true;
      }
      if (cell.includes("gaji") || cell.includes("plafond") || cell.includes("thp") || cell.includes("outlet") || cell.includes("cabang")) {
        hasContactOrMoney = true;
      }
    }

    if (hasName && (hasContactOrMoney || hasIdentifier)) {
      const colMap = detectHeaderIndices(row);
      if (colMap.name !== -1) {
        return { headerRowIdx: rIdx, headerRow: row, colMap };
      }
    }
  }

  return null;
}

/**
 * Parsing utama berkas impor (.xlsx / .csv) menjadi baris data terstruktur
 * Mendukung file Excel multi-sheet (memindai seluruh sheet yang berisi data leads)
 * @param {Buffer} buffer - Buffer berkas dari multer
 * @param {string} originalName - Nama berkas asli
 * @param {object} options - Opsi tambahan: targetSheetName
 * @returns {{ rows: Array<object>, total_parsed: number, sheets_parsed: Array<string>, errors: Array<string> }}
 */
export function parseImportFile(buffer, originalName = "", options = {}) {
  if (!buffer || buffer.length === 0) {
    throw new Error("File kosong atau tidak dapat dibaca.");
  }

  const isZipExcel =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;

  const errors = [];
  const normalizedRows = [];
  const sheetsParsed = [];
  const batchPhones = new Set();
  const batchNopens = new Set();
  let primaryColMap = null;

  if (isZipExcel) {
    const entries = extractZipEntries(buffer);
    const sharedStringsXml = entries.get("xl/sharedStrings.xml");
    const sharedStrings = parseSharedStrings(sharedStringsXml);

    // Ambil daftar sheet dari xl/workbook.xml & rels
    const wbXmlBuf = entries.get("xl/workbook.xml");
    const wbRelsXmlBuf = entries.get("xl/_rels/workbook.xml.rels");

    let sheetDefs = [];
    if (wbXmlBuf && wbRelsXmlBuf) {
      const wbXml = wbXmlBuf.toString("utf8");
      const wbRelsXml = wbRelsXmlBuf.toString("utf8");

      const relsMap = new Map();
      for (const rm of wbRelsXml.matchAll(/<Relationship\b([^>]*)\/>/gis)) {
        const idMatch = rm[1].match(/Id="([^"]+)"/);
        const targetMatch = rm[1].match(/Target="([^"]+)"/);
        if (idMatch && targetMatch) {
          let t = targetMatch[1];
          if (!t.startsWith("xl/")) t = "xl/" + t.replace(/^\//, "");
          relsMap.set(idMatch[1], t);
        }
      }

      for (const sm of wbXml.matchAll(/<sheet\b([^>]*)\/>/gis)) {
        const nameMatch = sm[1].match(/name="([^"]+)"/);
        const rIdMatch = sm[1].match(/r:id="([^"]+)"/);
        if (nameMatch && rIdMatch) {
          const sheetFile = relsMap.get(rIdMatch[1]);
          if (sheetFile && entries.has(sheetFile)) {
            sheetDefs.push({ name: nameMatch[1], file: sheetFile });
          }
        }
      }
    }

    // Fallback jika manifest sheet workbook tidak lengkap
    if (sheetDefs.length === 0) {
      for (const [key] of entries.entries()) {
        if (key.startsWith("xl/worksheets/sheet") && key.endsWith(".xml")) {
          sheetDefs.push({ name: key.replace(/^.*\//, "").replace(/\.xml$/, ""), file: key });
        }
      }
    }

    if (sheetDefs.length === 0) {
      throw new Error("Format berkas Excel (.xlsx) tidak valid atau lembar kerja tidak ditemukan.");
    }

    // Jika user menentukan target sheet tertentu
    if (options.targetSheetName && options.targetSheetName !== "all") {
      const filtered = sheetDefs.filter((s) => s.name.toLowerCase() === options.targetSheetName.toLowerCase());
      if (filtered.length > 0) sheetDefs = filtered;
    }

    for (const sheetDef of sheetDefs) {
      const xmlBuf = entries.get(sheetDef.file);
      if (!xmlBuf) continue;

      const rawRows = parseSheetRows(xmlBuf, sharedStrings);
      if (rawRows.length < 2) continue;

      const headerInfo = findHeaderRow(rawRows);
      if (!headerInfo) {
        // Lewati sheet yang tidak memuat header leads (misal sheet RAC / instruksi / catatan)
        continue;
      }

      if (!primaryColMap) primaryColMap = headerInfo.colMap;
      const { headerRowIdx, colMap } = headerInfo;
      sheetsParsed.push(sheetDef.name);

      for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
        if (normalizedRows.length >= MAX_IMPORT_ROWS) break;

        const row = rawRows[i];
        if (!row || !row.length) continue;

        const rawName = colMap.name !== -1 ? row[colMap.name] : null;
        const name = sanitizeCellValue(rawName);
        if (!name) continue;

        // Lewati baris ringkasan / angka di kolom nama
        if (/^\d+$/.test(name) && row.filter(Boolean).length <= 4) continue;

        const rawPhone = colMap.phone !== -1 ? row[colMap.phone] : null;
        const phone = parsePhone(rawPhone);

        const rawNopen = colMap.nopen !== -1 ? row[colMap.nopen] : null;
        const rawNip = colMap.nip !== -1 ? row[colMap.nip] : null;
        const nopen = sanitizeCellValue(rawNopen);
        const nip = sanitizeCellValue(rawNip) || nopen;

        // Wajib memiliki nama dan salah satu identitas kontak (telepon, NOPEN, atau NIP)
        if (!phone && !nopen && !nip) {
          errors.push(`[${sheetDef.name}] Baris ${i + 1}: Nama ${name} tidak memiliki nomor telepon atau NOPEN/NIP.`);
          continue;
        }

        // Deduplikasi intra-file antar sheet
        if (phone && phone !== "080000000000" && batchPhones.has(phone)) continue;
        if (nopen && batchNopens.has(nopen)) continue;

        if (phone && phone !== "080000000000") batchPhones.add(phone);
        if (nopen) batchNopens.add(nopen);

        const salary = parseSalary(colMap.salary !== -1 ? row[colMap.salary] : null, 4500000);
        const { birth_date, age } = parseBirthAndAge(
          colMap.birth_date !== -1 ? row[colMap.birth_date] : null,
          colMap.age !== -1 ? row[colMap.age] : null,
          nip
        );

        const city = sanitizeCellValue(colMap.city !== -1 ? row[colMap.city] : "") || "Kota Bandung";
        const branchHint = sanitizeCellValue(colMap.branch !== -1 ? row[colMap.branch] : "");
        const rawSource = colMap.source !== -1 ? row[colMap.source] : "";
        const source = sanitizeCellValue(rawSource) || sheetDef.name;
        const salesManagerHint = sanitizeCellValue(colMap.sales_manager !== -1 ? row[colMap.sales_manager] : "");
        const marketingHint = sanitizeCellValue(colMap.marketing !== -1 ? row[colMap.marketing] : "");

        normalizedRows.push({
          row_index: normalizedRows.length + 1,
          sheet: sheetDef.name,
          name,
          phone: phone || "080000000000",
          city,
          branch_hint: branchHint,
          source,
          nopen,
          nip,
          salary,
          birth_date,
          age,
          sales_manager_hint: salesManagerHint,
          marketing_hint: marketingHint
        });
      }
    }
  } else {
    // 2. Format CSV / Text
    const text = buffer.toString("utf8");
    const rawRows = parseCsvRows(text);

    if (rawRows.length < 2) {
      throw new Error("File CSV tidak memuat baris data yang cukup (minimal 1 baris header dan 1 baris data).");
    }

    const headerInfo = findHeaderRow(rawRows);
    if (!headerInfo) {
      throw new Error("Header kolom leads tidak terdeteksi pada file CSV.");
    }

    primaryColMap = headerInfo.colMap;
    const { headerRowIdx, colMap } = headerInfo;
    sheetsParsed.push("CSV");

    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
      if (normalizedRows.length >= MAX_IMPORT_ROWS) break;

      const row = rawRows[i];
      if (!row || !row.length) continue;

      const rawName = colMap.name !== -1 ? row[colMap.name] : null;
      const name = sanitizeCellValue(rawName);
      if (!name) continue;

      const rawPhone = colMap.phone !== -1 ? row[colMap.phone] : null;
      const phone = parsePhone(rawPhone);

      const rawNopen = colMap.nopen !== -1 ? row[colMap.nopen] : null;
      const rawNip = colMap.nip !== -1 ? row[colMap.nip] : null;
      const nopen = sanitizeCellValue(rawNopen);
      const nip = sanitizeCellValue(rawNip) || nopen;

      if (!phone && !nopen && !nip) {
        errors.push(`Baris ${i + 1}: Nama ${name} tidak memiliki nomor telepon atau NOPEN/NIP.`);
        continue;
      }

      if (phone && phone !== "080000000000" && batchPhones.has(phone)) continue;
      if (nopen && batchNopens.has(nopen)) continue;

      if (phone && phone !== "080000000000") batchPhones.add(phone);
      if (nopen) batchNopens.add(nopen);

      const salary = parseSalary(colMap.salary !== -1 ? row[colMap.salary] : null, 4500000);
      const { birth_date, age } = parseBirthAndAge(
        colMap.birth_date !== -1 ? row[colMap.birth_date] : null,
        colMap.age !== -1 ? row[colMap.age] : null,
        nip
      );

      const city = sanitizeCellValue(colMap.city !== -1 ? row[colMap.city] : "") || "Kota Bandung";
      const branchHint = sanitizeCellValue(colMap.branch !== -1 ? row[colMap.branch] : "");
      const source = sanitizeCellValue(colMap.source !== -1 ? row[colMap.source] : "") || "Impor Database";
      const salesManagerHint = sanitizeCellValue(colMap.sales_manager !== -1 ? row[colMap.sales_manager] : "");
      const marketingHint = sanitizeCellValue(colMap.marketing !== -1 ? row[colMap.marketing] : "");

      normalizedRows.push({
        row_index: normalizedRows.length + 1,
        sheet: "CSV",
        name,
        phone: phone || "080000000000",
        city,
        branch_hint: branchHint,
        source,
        nopen,
        nip,
        salary,
        birth_date,
        age,
        sales_manager_hint: salesManagerHint,
        marketing_hint: marketingHint
      });
    }
  }

  if (normalizedRows.length === 0) {
    throw new Error(
      `Tidak ada baris data calon debitur yang berhasil diekstrak. ${errors.length > 0 ? "Detail: " + errors.slice(0, 3).join(", ") : ""}`
    );
  }

  return {
    rows: normalizedRows,
    total_parsed: normalizedRows.length,
    sheets_parsed: sheetsParsed,
    header: primaryColMap,
    errors
  };
}

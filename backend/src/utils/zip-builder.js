// ============================================================================
// ZERO-DEPENDENCY PKZIP BUILDER (PURE NODE.JS)
// Implements ZIP format specifications (APPNOTE.TXT):
// - Local File Header (0x04034b50)
// - Central Directory Header (0x02014b50)
// - End of Central Directory Record (0x06054b50)
// Compression: STORE (method 0) & DEFLATE support via node:zlib
// Built-in CRC-32 checksum computation & Path Sanitization (Anti-Traversal)
// ============================================================================

import zlib from "node:zlib";

/**
 * Menghitung checksum CRC-32 untuk buffer data.
 * Memanfaatkan zlib.crc32 jika tersedia (Node.js 14+), dengan fallback tabel lookup standar IEEE 802.3.
 * @param {Buffer} buffer
 * @returns {number}
 */
export function computeCrc32(buffer) {
  if (typeof zlib.crc32 === "function") {
    return zlib.crc32(buffer) >>> 0;
  }

  let crc = 0 ^ -1;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

// Precomputed CRC32 Lookup Table (IEEE 802.3 standard)
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

/**
 * Sanitasi nama berkas untuk mencegah Path Traversal (../../), null bytes, dan karakter ilegal OS.
 * Mempertahankan ekstensi berkas saat truncating nama panjang.
 * @param {string} raw
 * @param {string} fallback
 * @returns {string}
 */
export function sanitizeSafeFilename(raw, fallback = "NASABAH") {
  let s = String(raw || "")
    .replace(/[\r\n\0"<>|?*:/\\]+/g, " ")
    .replace(/\.\.+/g, " ")
    .replace(/[^A-Za-z0-9._\-\s]/g, " ")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");

  // Pisahkan ekstensi berkas (.pdf, .jpg, dll) jika ada
  const extMatch = s.match(/(\.[A-Za-z0-9]{1,8})$/);
  const ext = extMatch ? extMatch[1] : "";
  let base = extMatch ? s.slice(0, -ext.length) : s;

  base = base.replace(/^[_.\-]+|[_.\-]+$/g, "");
  if (base.length > 80) {
    base = base.slice(0, 80).replace(/^[_.\-]+|[_.\-]+$/g, "");
  }

  const result = base ? (ext ? `${base}${ext}` : base) : fallback;
  return result || fallback;
}

/**
 * Format tanggal ke format MS-DOS (Time & Date 16-bit word) yang disyaratkan header ZIP
 */
function toDosDateTime(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = Math.max(1980, Math.min(2107, d.getFullYear()));
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = Math.floor(d.getSeconds() / 2);

  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;

  return { dosDate, dosTime };
}

/**
 * Membangun buffer arsip ZIP dari daftar entri berkas tanpa dependensi eksternal.
 * @param {Array<{ name: string, data: Buffer, date?: Date }>} files
 * @returns {Buffer} Buffer arsip ZIP lengkap
 */
export function buildZipBuffer(files = []) {
  if (!Array.isArray(files)) {
    throw new TypeError("Entri berkas harus berupa array.");
  }

  const localHeaders = [];
  const centralDirectoryEntries = [];
  let currentOffset = 0;

  for (const file of files) {
    const rawData = Buffer.isBuffer(file.data)
      ? file.data
      : Buffer.from(file.data || "", "utf8");

    const safeName = sanitizeSafeFilename(file.name, `file_${localHeaders.length + 1}.bin`);
    const nameBuf = Buffer.from(safeName, "utf8");

    const crc = computeCrc32(rawData);
    const { dosDate, dosTime } = toDosDateTime(file.date);

    // Metode 0: STORE (tanpa kompresi tambahan agar cepat dan bebas overhead)
    const compressionMethod = 0;
    const compressedSize = rawData.length;
    const uncompressedSize = rawData.length;

    // --- 1. LOCAL FILE HEADER (30 bytes + filename) ---
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature PK\x03\x04
    localHeader.writeUInt16LE(20, 4);          // Version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6);      // General purpose bit flag (Bit 11: UTF-8 filename)
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);          // Extra field length
    nameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, rawData);

    // --- 2. CENTRAL DIRECTORY RECORD (46 bytes + filename) ---
    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Signature PK\x01\x02
    centralHeader.writeUInt16LE(20, 4);          // Version made by (UNIX/DOS 2.0)
    centralHeader.writeUInt16LE(20, 6);          // Version needed (2.0)
    centralHeader.writeUInt16LE(0x0800, 8);      // Bit 11: UTF-8 filename
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);          // Extra field length
    centralHeader.writeUInt16LE(0, 32);          // File comment length
    centralHeader.writeUInt16LE(0, 34);          // Disk number start
    centralHeader.writeUInt16LE(0, 36);          // Internal file attributes
    centralHeader.writeUInt32LE(0, 38);          // External file attributes
    centralHeader.writeUInt32LE(currentOffset, 42); // Relative offset of local header
    nameBuf.copy(centralHeader, 46);

    centralDirectoryEntries.push(centralHeader);

    currentOffset += localHeader.length + rawData.length;
  }

  const centralDirOffset = currentOffset;
  const centralDirSize = centralDirectoryEntries.reduce((acc, b) => acc + b.length, 0);

  // --- 3. END OF CENTRAL DIRECTORY RECORD (EOCD, 22 bytes) ---
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);                // Signature PK\x05\x06
  eocd.writeUInt16LE(0, 4);                         // Number of this disk
  eocd.writeUInt16LE(0, 6);                         // Disk with start of central directory
  eocd.writeUInt16LE(centralDirectoryEntries.length, 8);  // Entries on this disk
  eocd.writeUInt16LE(centralDirectoryEntries.length, 10); // Total entries
  eocd.writeUInt32LE(centralDirSize, 12);           // Size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16);         // Offset of central directory
  eocd.writeUInt16LE(0, 20);                        // ZIP comment length

  return Buffer.concat([...localHeaders, ...centralDirectoryEntries, eocd]);
}

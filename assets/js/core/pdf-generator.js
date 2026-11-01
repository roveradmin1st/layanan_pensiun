// ============================================================================
// OFFICIAL PDF REPORT GENERATOR (CLIENT & ENTERPRISE COMPATIBLE)
// Menghasilkan dokumen PDF simulasi kredit resmi (%PDF-1.4) dengan logo resmi,
// rincian biaya, retensi terpisah, validasi, dan 4 kotak tanda tangan.
// Kompatibel di semua browser Android, iOS, Tablet, dan Desktop.
// ============================================================================

window.PDFGenerator = {
  fmtCurrency(n) {
    return Number.isFinite(n)
      ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Math.round(n))
      : "-";
  },

  escPdf(str) {
    return String(str ?? "-")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, " ")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  },

  wrapText(str, maxLen) {
    const out = [];
    let rem = String(str ?? "-").replace(/\s+/g, " ").trim() || "-";
    while (rem.length > maxLen) {
      let idx = rem.lastIndexOf(" ", maxLen);
      if (idx < 12) idx = maxLen;
      out.push(rem.slice(0, idx));
      rem = rem.slice(idx).trim();
    }
    out.push(rem);
    return out;
  },

  downloadSimulationPdf(result) {
    if (!result || !result.hasCoreInput) {
      alert("Mohon lengkapi data simulasi terlebih dahulu sebelum mengunduh PDF.");
      return;
    }

    const PUR = "0.40 0.13 0.78",
      LAV = "0.96 0.94 0.99",
      ORG = "0.96 0.47 0.09",
      NAV = "0.09 0.15 0.30",
      BLUE = "0.03 0.47 0.55",
      PALE = "0.93 0.96 0.99",
      WHITE = "1 1 1",
      INK = "0.13 0.17 0.25",
      MUTED = "0.38 0.42 0.49",
      BORDER = "0.84 0.87 0.91",
      GREEN = "0.06 0.48 0.27",
      RED = "0.70 0.14 0.09",
      AMBER = "0.60 0.36 0.04";

    let c = "";
    const rect = (x, y, w, h, color) => { c += `${color} rg ${x} ${y} ${w} ${h} re f\n`; };
    const stroke = (x, y, w, h, color, width = 0.6) => { c += `${color} RG ${width} w ${x} ${y} ${w} ${h} re S\n`; };
    const ln = (x, y, x2, y2, color, width = 0.5) => { c += `${color} RG ${width} w ${x} ${y} m ${x2} ${y2} l S\n`; };
    const t = (x, y, size, s, color = INK, font = "F1") => {
      c += `${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${this.escPdf(s)}) Tj ET\n`;
    };

    const hasLogo = Boolean(window.BRAND_ASSETS && window.BRAND_ASSETS.amsPdfJpegBase64);

    // 1. Header Banner
    rect(0, 748, 595, 94, NAV);
    rect(0, 748, 9, 94, PUR);
    rect(9, 748, 5, 94, ORG);
    if (hasLogo) {
      rect(25, 759, 65, 72, WHITE);
      c += "q 54 0 0 68 30 761 cm /Logo Do Q\n";
    }
    t(105, 812, 8.5, "LAYANAN PENSIUNAN  |  " + (result.partnerName || "SIMULASI KREDIT").toUpperCase(), WHITE, "F2");
    t(105, 787, 17, "RINCIAN SIMULASI KREDIT RESMI", WHITE, "F2");
    t(105, 767, 8, `TANGGAL PROSES: ${result.debtor.processDate}   |   WILAYAH: ${result.debtor.region || "-"}`, "0.89 0.92 0.98");
    rect(468, 779, 100, 32, result.overallValid ? GREEN : ORG);
    t(477, 798, 7, "STATUS VALIDASI", WHITE, "F2");
    t(477, 786, 7, result.overallValid ? "SESUAI STANDAR" : "PERLU PERIKSA", WHITE, "F2");

    // 2. Identitas Debitur & Parameter Pengajuan
    rect(27, 670, 541, 64, LAV);
    stroke(27, 670, 541, 64, BORDER);
    t(39, 718, 8, "01  IDENTITAS DEBITUR & KATEGORI PRODUK", PUR, "F2");
    t(39, 700, 10, "Nama Debitur: " + result.debtor.name, INK, "F2");
    t(39, 684, 7.5, `Tgl Lahir: ${result.debtor.dob}   |   Usia: ${result.debtor.ageText}   |   Kategori: ${result.product.category}`, MUTED);
    t(350, 700, 8.5, "Penghasilan / Gaji: " + this.fmtCurrency(result.simulation.salary), INK, "F2");
    t(350, 684, 7.5, `Rasio Angsuran Aktual: ${result.simulation.actualInstallmentRatio.toFixed(2)}% (Maks ${result.product.maxInstallmentRatio || 95}%)`, MUTED);

    // 3. Highlight Pencairan Bersih & Angsuran
    rect(27, 610, 541, 46, NAV);
    rect(27, 610, 4, 46, ORG);
    t(41, 640, 7.5, "ESTIMASI SISA PENCAIRAN BERSIH (TERIMA BERSIH)", "0.88 0.91 0.98", "F2");
    t(41, 620, 15, this.fmtCurrency(result.simulation.netDisbursement), WHITE, "F2");

    const instLabel = result.engine === "bsi_simas"
      ? "ANGSURAN AKTIF / PENSIUN"
      : "ANGSURAN KOPERASI / BULAN";
    const instValue = result.engine === "bsi_simas"
      ? `${this.fmtCurrency(result.simulation.coopInstallment)} / ${this.fmtCurrency(result.simulation.pensionInstallment)}`
      : this.fmtCurrency(result.simulation.coopInstallment);
    t(325, 640, 7.5, instLabel, "0.88 0.91 0.98", "F2");
    t(325, 620, 11.5, instValue, WHITE, "F2");

    // 4. Mini KPI Cards
    const mini = (x, w, label, value) => {
      rect(x, 558, w, 40, PALE);
      stroke(x, 558, w, 40, BORDER);
      t(x + 9, 583, 7, label, MUTED, "F2");
      t(x + 9, 567, 9.5, value, INK, "F2");
    };
    mini(27, 130, "PLAFOND PENGAJUAN", this.fmtCurrency(result.simulation.plafond));
    mini(164, 115, "TENOR KREDIT", `${result.simulation.tenor} Bulan`);
    if (result.engine === "ams2") {
      mini(286, 138, "ANGSURAN BANK (12%) / BAA", `${this.fmtCurrency(result.simulation.bankInstallment)} / ${this.fmtCurrency(result.simulation.baaMonthly)}`);
    } else if (result.engine === "bsi_simas") {
      mini(286, 138, "RATE AKTIF / PENSIUN", `${result.product.priceAtribAktifPercent}% / ${result.product.priceAtribPensiunPercent}%`);
    } else {
      mini(286, 138, "SUKU BUNGA MITRA", `${result.product.coopRateAnnual}% / tahun`);
    }
    mini(431, 137, "SISA GAJI / BULAN", this.fmtCurrency(result.simulation.remainingSalary));

    // 5. Tabel Rincian Biaya & Pengurang Pencairan (Terpisah sesuai command.md)
    rect(27, 526, 541, 20, PUR);
    t(39, 533, 8, "02  RINCIAN BIAYA KREDIT & PENGURANG PENCAIRAN", WHITE, "F2");
    t(451, 533, 7, "NOMINAL (IDR)", WHITE, "F2");

    let rows = [];
    if (result.engine === "ams2") {
      rows = [
        [`Biaya PROAQ (${result.product.proaqRate}%)`, this.fmtCurrency(result.simulation.proaqFee), false],
        [`Cadangan Risiko ${result.product.category} (${result.product.riskReserveRate}%)`, this.fmtCurrency(result.simulation.riskReserveFee), false],
        ["Biaya Administrasi Resmi", this.fmtCurrency(result.simulation.adminFee), false],
        [`Biaya Tata Laksana (${result.product.tataLaksanaPercent}%)`, this.fmtCurrency(result.simulation.tataLaksanaFee), false],
        ["TOTAL BIAYA KREDIT", this.fmtCurrency(result.simulation.totalCreditCost), true],
        ["Nilai Take Over (Pengurang Pencairan)", this.fmtCurrency(result.simulation.takeOverAmount), false],
        [`Retensi Angsuran (${result.product.retentionMultiplier}x Angsuran Koperasi Aktual)`, this.fmtCurrency(result.simulation.retentionAmount), false]
      ];
    } else if (result.engine === "bsi_simas") {
      rows = [
        ["Biaya Administrasi BSI (1%)", this.fmtCurrency(result.simulation.adminFee), false],
        ["Biaya Materai", this.fmtCurrency(result.simulation.materaiFee), false],
        [`Kontribusi Asuransi Simas Jiwa (${result.product.atribusiModeLabel})`, this.fmtCurrency(result.simasInsurance.totalKontribusi), false],
        ["TOTAL BIAYA KREDIT (POTONGAN LANGSUNG)", this.fmtCurrency(result.simulation.totalCreditCost), true],
        ["Blokir Angsuran Masa Aktif (1x)", this.fmtCurrency(result.simulation.blokirAktifNominal), false],
        ["Blokir Angsuran Masa Pensiun (2x)", this.fmtCurrency(result.simulation.blokirPensiunNominal), false],
        ["Pelunasan Fasilitas Lama / Take Over", this.fmtCurrency(result.simulation.takeOverAmount), false]
      ];
    } else {
      rows = [
        [`Biaya Provisi (${result.product.provisionRatePercent}%)`, this.fmtCurrency(result.simulation.proaqFee), false],
        [`Premi Asuransi (${result.product.insuranceRatePercent}%)`, this.fmtCurrency(result.simulation.riskReserveFee), false],
        ["Biaya Administrasi", this.fmtCurrency(result.simulation.adminFee), false],
        [`Biaya Tata Laksana (${result.product.tataLaksanaPercent}%)`, this.fmtCurrency(result.simulation.tataLaksanaFee), false],
        ["TOTAL BIAYA KREDIT", this.fmtCurrency(result.simulation.totalCreditCost), true],
        ["Nilai Take Over", this.fmtCurrency(result.simulation.takeOverAmount), false],
        [`Retensi / Blokir Angsuran (${result.product.retentionMultiplier}x)`, this.fmtCurrency(result.simulation.retentionAmount), false]
      ];
    }

    let y = 507;
    rows.forEach(([label, val, isBold], idx) => {
      if (isBold) rect(27, y - 4, 541, 18, LAV);
      else if (idx % 2 === 0) rect(27, y - 4, 541, 18, "0.985 0.988 0.994");
      t(39, y + 1, 7.8, label, isBold ? PUR : INK, isBold ? "F2" : "F1");
      t(445, y + 1, 7.8, val, isBold ? PUR : INK, isBold ? "F2" : "F1");
      ln(27, y - 4, 568, y - 4, BORDER, 0.35);
      y -= 18;
    });

    // 6. Bagian Validasi Otomatis
    rect(27, 355, 541, 19, PALE);
    t(39, 362, 8, "03  HASIL PEMERIKSAAN & VALIDASI OTOMATIS", BLUE, "F2");
    let vy = 342;
    (result.checks || []).slice(0, 4).forEach(ch => {
      const col = ch.level === "pass" ? GREEN : ch.level === "fail" ? RED : AMBER;
      const tag = ch.level === "pass" ? "SESUAI" : ch.level === "fail" ? "TIDAK SESUAI" : "PERHATIAN";
      t(39, vy, 6.5, `[${tag}]`, col, "F2");
      const lines = this.wrapText(`${ch.title}: ${ch.message}`, 82);
      t(95, vy, 6.7, lines[0], INK);
      vy -= 11;
      if (lines[1]) {
        t(95, vy, 6.5, lines[1], MUTED);
        vy -= 10;
      }
    });

    // 7. Pernyataan Nasabah & 4 Kotak Tanda Tangan
    rect(27, 258, 541, 28, LAV);
    stroke(27, 258, 541, 28, BORDER);
    rect(27, 258, 3, 28, ORG);
    t(38, 274, 7.2, "PERNYATAAN PERSETUJUAN AWAL NASABAH", PUR, "F2");
    t(38, 263, 6.5, "Saya telah menerima penjelasan rincian simulasi di atas dan memahami bahwa hasil ini merupakan estimasi awal sesuai parameter mitra.", INK);

    const sx = [27, 164, 301, 438], sw = 130;
    const roles = [
      ["PIC OPERASIONAL", result.officers.pic || "MUHAMMAD TEGUH PRANADA"],
      ["ADMIN / SALES MGR", result.officers.smName || "-"],
      ["MARKETING", result.officers.marketingName || "-"],
      ["NASABAH / DEBITUR", result.debtor.name || "-"]
    ];
    sx.forEach((x, i) => {
      stroke(x, 168, sw, 78, BORDER, 0.6);
      t(x + 7, 232, 6.5, roles[i][0], i === 3 ? ORG : PUR, "F2");
      this.wrapText(roles[i][1], 22).slice(0, 2).forEach((part, j) => {
        t(x + 7, 220 - j * 9, 6.2, part, INK);
      });
      ln(x + 8, 186, x + sw - 8, 186, MUTED, 0.5);
      t(x + 7, 174, 5.7, "Tanda tangan & nama jelas", MUTED);
    });

    // 8. Footer
    ln(27, 152, 568, 152, ORG, 1.1);
    t(27, 138, 6.5, "LAYANAN PENSIUNAN — ENTERPRISE FINANCIAL PLATFORM  |  Amanah • Terpercaya • Dekat dengan Anda", PUR, "F2");
    t(27, 126, 6.0, `PIC: ${result.officers.pic}   |   Supervisor/Admin: ${result.officers.smName}   |   Marketing: ${result.officers.marketingName}`, MUTED);
    t(27, 114, 5.7, "© Layanan Pensiunan", MUTED);

    // 9. Rakit Binary PDF (%PDF-1.4)
    const enc = s => new TextEncoder().encode(s);
    const contentBytes = enc(c);
    const chunks = [], offs = [0];
    let total = 0;
    const put = b => { chunks.push(b); total += b.length; };

    put(enc("%PDF-1.4\n%LP-ENTERPRISE\n"));
    const addObj = (n, parts) => {
      offs[n] = total;
      put(enc(n + " 0 obj\n"));
      parts.forEach(put);
      put(enc("\nendobj\n"));
    };

    addObj(1, [enc("<< /Type /Catalog /Pages 2 0 R >>")]);
    addObj(2, [enc("<< /Type /Pages /Kids [7 0 R] /Count 1 >>")]);
    addObj(3, [enc("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")]);
    addObj(4, [enc("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")]);

    if (hasLogo) {
      const logoBin = atob(window.BRAND_ASSETS.amsPdfJpegBase64);
      const logoBytes = new Uint8Array(logoBin.length);
      for (let i = 0; i < logoBin.length; i++) logoBytes[i] = logoBin.charCodeAt(i);
      addObj(5, [
        enc("<< /Type /XObject /Subtype /Image /Width 412 /Height 606 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + logoBytes.length + " >>\nstream\n"),
        logoBytes,
        enc("\nendstream")
      ]);
    } else {
      addObj(5, [enc("<< /Type /XObject /Subtype /Form /BBox [0 0 1 1] /Length 0 >>\nstream\n\nendstream")]);
    }

    addObj(6, [enc("<< /Length " + contentBytes.length + " >>\nstream\n"), contentBytes, enc("\nendstream")]);
    addObj(7, [
      enc("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Logo 5 0 R >> >> /Contents 6 0 R >>")
    ]);

    const xref = total;
    put(enc("xref\n0 8\n0000000000 65535 f \n"));
    for (let i = 1; i <= 7; i++) {
      put(enc(String(offs[i]).padStart(10, "0") + " 00000 n \n"));
    }
    put(enc("trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF"));

    const blob = new Blob(chunks, { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = String(result.debtor.name || "Debitur").replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "Debitur";
    a.href = url;
    a.download = `Simulasi_${result.engine.toUpperCase()}_${safeName}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    window.StorageService.logAudit("PDF_DOWNLOADED", safeName, `Mengunduh PDF simulasi resmi untuk debitur ${result.debtor.name} (${result.partnerName})`);
  }
};

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Download, Loader2 } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { rp, fmtDate } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import CurrencyInput from "../components/calc/CurrencyInput";

const DEMO = Object.freeze({
  birth_date: "1966-06-10", process_date: "2026-10-01", insurance_start_date: "2026-10-01",
  first_installment_date: "2026-11-01", pension_salary: 2301400, principal: 166000000,
  tenor_months: 169, base_rate_pct: 10.5, retired_type: "pensiunan", spouse_status: "single",
  ratio_basis: "DBR", ratio_pct: 90, ongoing_installments: 0, settlement_amount: 0, flagging: "TASPEN_CTP"
});
const EMPTY = Object.fromEntries(Object.keys(DEMO).map((key) => [key,
  ["retired_type", "spouse_status", "ratio_basis", "ratio_pct", "flagging", "ongoing_installments", "settlement_amount"].includes(key) ? DEMO[key] : ""
]));
const CONTROL = "h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-[#351080] focus:outline-none focus:ring-2 focus:ring-[#351080]/20";
const MONEY = new Set(["pension_salary", "principal", "ongoing_installments", "settlement_amount"]);
const NUMBERS = new Set(["tenor_months", "base_rate_pct"]);
const LABELS = {
  birth_date: "Tanggal lahir", process_date: "Tanggal pencairan", insurance_start_date: "Tanggal mulai polis",
  first_installment_date: "Tanggal angsuran pertama", pension_salary: "Gaji pensiun diakui (100%)",
  principal: "Plafon yang disimulasikan", tenor_months: "Tenor pembiayaan dan polis (bulan)",
  base_rate_pct: "Harga dasar tahunan (%)", ongoing_installments: "Cicilan lain yang tetap berjalan per bulan",
  settlement_amount: "Total pelunasan fasilitas lama saat pencairan"
};

function Field({ name, value, onChange }) {
  const label = LABELS[name];
  return <div className="min-w-0 space-y-1.5">
    <label htmlFor={`pen-${name}`} className="block text-sm font-medium text-slate-700">{label}</label>
    {MONEY.has(name)
      ? <CurrencyInput id={`pen-${name}`} required value={value} onChange={(v) => onChange(name, v)} />
      : <input id={`pen-${name}`} className={CONTROL} required
          type={NUMBERS.has(name) ? "number" : "date"} value={value}
          min={name === "tenor_months" ? 1 : name === "base_rate_pct" ? 0.0001 : undefined}
          max={name === "tenor_months" ? 180 : name === "base_rate_pct" ? 100 : undefined}
          step={name === "base_rate_pct" ? "0.0001" : "1"}
          onChange={(e) => onChange(name, e.target.value)} />}
  </div>;
}

function Choice({ name, label, options, value, onChange }) {
  return <div className="min-w-0 space-y-1.5">
    <label htmlFor={`pen-${name}`} className="block text-sm font-medium text-slate-700">{label}</label>
    <select id={`pen-${name}`} className={CONTROL} value={value} onChange={(e) => onChange(name, e.target.value)}>
      {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
    </select>
  </div>;
}

function downloadResult(result) {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `validasi-bsi-pensiun-${result.input.process_date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const MEDICAL = { MCU: "Perlu pemeriksaan medis", NON_MCU: "Non MCU; tetap mengikuti ketentuan polis", UNAVAILABLE: "Di luar batas pertanggungan" };
function Comparison({ result }) {
  const regular = result.scenarios.reguler, attributed = result.scenarios.atribusi_premi;
  const rows = [
    ["Plafon disimulasikan", "principal", rp],
    ["Harga akhir per tahun", "annual_price_pct", (v) => `${v.toLocaleString("id-ID", { maximumFractionDigits: 4 })}%`],
    ["Angsuran per bulan", "installment", rp],
    ["Premi / kontribusi asuransi", "premium", rp],
    ["Santunan asuransi", "sum_assured", rp],
    ["Administrasi", "admin_fee", rp], ["Materai", "stamp_fee", rp],
    ["Premi dipotong saat pencairan", "upfront_premium", rp],
    ["Blokir angsuran", "blocked_installments", rp],
    ["Pelunasan fasilitas lama", "settlement_amount", rp],
    ["Pencairan bersih", "net_disbursement", rp],
    ["Sisa gaji setelah semua cicilan", "remaining_pension_salary", rp],
    ["Rasio menurut basis yang dipilih", "template_ratio_pct", (v) => `${v.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`],
    ["Total angsuran selama tenor", "total_installments", rp],
    ["Kapasitas plafon indikatif pada tenor ini", "indicative_max_principal", rp],
    ["Pemeriksaan asuransi", "medical_status", (v) => MEDICAL[v]]
  ];
  return <section aria-labelledby="pen-result-title" className="lp-card space-y-4 p-4 sm:p-6" data-testid="pension-comparison">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="pen-result-title" className="text-lg font-bold text-[#17223B]">Perbandingan untuk validasi</h2>
      <button type="button" onClick={() => downloadResult(result)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">
        <Download className="h-4 w-4" /> Unduh hasil validasi
      </button>
    </div>
    <p className="text-sm text-slate-600">
      Usia polis nearest: {result.insurance_entry_age_nearest} tahun · Tarif: {result.insurance_tariff_permil.toLocaleString("id-ID")}‰ · Kapasitas angsuran: {rp(result.installment_capacity)}.
    </p>
    <div className="overflow-x-auto rounded-lg border border-slate-200" tabIndex={0} aria-label="Tabel perbandingan dapat digeser pada layar kecil">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="bg-slate-50"><tr><th scope="col" className="p-3 text-left">Komponen</th><th scope="col" className="p-3 text-right">Reguler</th><th scope="col" className="p-3 text-right">Atribusi premi</th></tr></thead>
        <tbody>{rows.map(([label, key, format]) => <tr key={key} className={`border-t border-slate-100 ${key === "net_disbursement" ? "bg-emerald-50 font-bold" : ""}`}>
          <th scope="row" className="p-3 text-left font-medium">{label}</th>
          <td className="p-3 text-right tabular-nums" data-testid={`reguler-${key}`}>{format(regular[key])}</td>
          <td className="p-3 text-right tabular-nums" data-testid={`atribusi-${key}`}>{format(attributed[key])}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="text-xs text-slate-500">Kapasitas indikatif dibatasi kemampuan angsuran dan santunan Simas, dengan langkah Rp1 juta. Angka ini belum merupakan plafon resmi bank.</p>
    <div className="grid gap-4 md:grid-cols-2">{[["Reguler", regular], ["Atribusi premi", attributed]].map(([title, value]) => <div key={title} className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className={`mt-1 text-sm font-medium ${value.within_template_checks ? "text-slate-700" : "text-red-700"}`}>
        {value.within_template_checks ? "Pemeriksaan angka terpenuhi; masih menunggu validasi klien." : "Ada batas atau tanggal yang belum terpenuhi."}
      </p>
      <ul className="mt-3 space-y-2 text-sm">{value.checks.map((check) => <li key={check.key} className={check.ok ? "text-slate-600" : "font-medium text-red-700"}>
        {check.ok ? "✓" : "Periksa:"} {check.label}
      </li>)}</ul>
      {value.end_age_rule_disagrees && <p className="mt-3 text-sm font-semibold text-red-700">Label batas usia dan rumus template memberikan hasil berbeda. Perlu keputusan klien.</p>}
    </div>)}</div>
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      <div><dt className="text-slate-500">Angsuran terakhir</dt><dd className="font-semibold">{fmtDate(result.dates.last_installment)}</dd></div>
      <div><dt className="text-slate-500">Akhir polis menurut model</dt><dd className="font-semibold">{fmtDate(result.dates.insurance_end)}</dd></div>
      <div><dt className="text-slate-500">Jatuh tempo menurut tanggal cair di template</dt><dd className="font-semibold">{fmtDate(result.dates.bank_maturity_source_date)}</dd></div>
    </dl>
    <details className="rounded-lg bg-amber-50 p-4 text-sm text-amber-950">
      <summary className="cursor-pointer font-semibold">Dasar dan batas validasi</summary>
      <ul className="mt-3 list-disc space-y-2 pl-5">{result.notes.map((note) => <li key={note}>{note}</li>)}</ul>
      <p className="mt-3 text-xs">Versi: {result.model_version} · {result.insurance_profile_version}</p>
    </details>
  </section>;
}

export default function PensionValidation() {
  const { user } = useAuth();
  const permitted = ["super_admin", "admin_ops"].includes(user?.role);
  const [form, setForm] = useState({ ...EMPTY });
  const [enabled, setEnabled] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const controller = useRef(null);
  useEffect(() => {
    if (!permitted) return;
    const abort = new AbortController();
    api.get("/bsi-pensiun/status", { signal: abort.signal }).then(({ data }) => setEnabled(data.enabled === true)).catch((err) => {
      if (!abort.signal.aborted) { setEnabled(false); setError(errMsg(err, "Modul validasi belum tersedia.")); }
    });
    return () => { abort.abort(); controller.current?.abort(); generation.current++; };
  }, [permitted]);

  function change(name, value) {
    generation.current++;
    controller.current?.abort();
    setBusy(false);
    setForm((old) => ({ ...old, [name]: value }));
    setResult(null); // Never show a previous quote for newly edited input.
    setError("");
  }
  function loadDemo() {
    generation.current++;
    controller.current?.abort();
    setBusy(false); setForm({ ...DEMO }); setResult(null); setError("");
  }
  async function calculate(event) {
    event.preventDefault();
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const current = ++generation.current;
    setBusy(true); setResult(null); setError("");
    try {
      const { data } = await api.post("/bsi-pensiun/compare", form, { signal: abort.signal });
      if (current === generation.current) setResult(data);
    } catch (err) {
      if (current === generation.current && !abort.signal.aborted) setError(errMsg(err));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }

  if (!permitted) return <p role="alert" className="lp-card p-6">Modul validasi tersedia untuk Super Admin dan Admin Operasional.</p>;
  return <div className="space-y-5" data-testid="pension-validation-page">
    <Link to="/kalkulator" className="inline-flex items-center gap-2 text-sm text-[#351080]"><ArrowLeft className="h-4 w-4" /> Kembali ke simulasi mitra</Link>
    <header className="lp-card p-4 sm:p-6"><p className="text-sm font-semibold text-[#078D67]">BSI Pensiun Berkah</p>
      <h1 className="mt-1 text-2xl font-bold text-[#17223B]">Validasi Reguler dan Atribusi Premi</h1>
      <p className="mt-2 text-sm text-slate-600">Bandingkan dua skema menggunakan data yang sama. Hasil sementara untuk dicocokkan bersama klien.</p>
    </header>
    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <AlertTriangle className="h-5 w-5 shrink-0" /><p>Gunakan data uji. Hasil belum dapat disimpan sebagai pengajuan, persetujuan, atau PDF penawaran. Penalti dan penyesuaian khusus asuransi belum termasuk.</p>
    </div>
    {enabled === null && <p role="status" className="inline-flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Memeriksa ketersediaan modul…</p>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {enabled && <form onSubmit={calculate} className="lp-card space-y-5 p-4 sm:p-6" data-testid="pension-form">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Data simulasi</h2>
        <button type="button" onClick={loadDemo} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">Isi contoh uji</button>
      </div>
      <p className="text-xs text-slate-500">Contoh uji memakai tanggal yang diselaraskan dan harga template 10,5%. Harga berlaku perlu dikonfirmasi klien.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Object.keys(LABELS).map((name) => <Field key={name} name={name} value={form[name]} onChange={change} />)}
        <Choice name="retired_type" label="Jenis penerima pensiun" value={form.retired_type} onChange={change} options={[["pensiunan", "Pensiunan"], ["janda", "Pensiun Janda (sesuai template)"]]} />
        <Choice name="spouse_status" label="Status pasangan" value={form.spouse_status} onChange={change} options={[["single", "Sendiri"], ["with_spouse", "Ada pasangan (faktor 98%)"]]} />
        <Choice name="ratio_basis" label="Basis rasio menurut template" value={form.ratio_basis} onChange={change} options={[["DBR", "DBR — memasukkan cicilan lain"], ["DSR", "DSR — sesuai definisi template"]]} />
        <Choice name="ratio_pct" label="Batas rasio" value={form.ratio_pct} onChange={change} options={[[70, "70%"], [90, "90%"]]} />
        <Choice name="flagging" label="Pengelola pembayaran pensiun" value={form.flagging} onChange={change} options={[["TASPEN", "TASPEN"], ["TASPEN_CTP", "TASPEN (CTP)"], ["ASABRI", "ASABRI"], ["DAPEN", "DAPEN"]]} />
      </div>
      <p className="text-xs text-slate-500">Cicilan yang dilunasi saat pencairan dimasukkan ke total pelunasan. Kolom cicilan bulanan hanya untuk kewajiban yang tetap berjalan.</p>
      <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#351080] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? "Menghitung…" : "Bandingkan simulasi"}
      </button>
    </form>}
    <div aria-live="polite" aria-busy={busy}>{result && <Comparison result={result} />}</div>
  </div>;
}

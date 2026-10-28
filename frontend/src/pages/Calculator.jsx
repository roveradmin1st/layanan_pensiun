import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ShieldCheck, AlertTriangle, RotateCcw, Save } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { rp, pct, fmtDate, ddmmyyyyToIso } from "../lib/format";
import { Logo } from "../components/brand/Logo";
import { CtaButton } from "../components/common";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import CurrencyInput from "../components/calc/CurrencyInput";
import ResultView from "../components/calc/ResultView";
import { AiSummary, DownloadActions } from "../components/calc/SimExtras";

const Step = ({ n, title, children, testid }) => (
  <section className="lp-card p-4 sm:p-6" data-testid={testid}>
    <div className="mb-4 sm:mb-5 flex items-center gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#351080] text-xs font-bold text-white shrink-0">{n}</span>
      <h2 className="font-display text-base font-bold text-[#17223B]">{title}</h2>
    </div>
    {children}
  </section>
);

const MaxRow = ({ k, v, strong, testid }) => (
  <div className="flex justify-between items-center gap-3 border-b border-slate-100 py-2 sm:py-2.5 text-xs sm:text-sm last:border-0">
    <span className="text-slate-500 shrink-0">{k}</span><span className={`lp-num text-right font-semibold truncate ${strong ? "text-[#351080]" : "text-[#17223B]"}`} data-testid={testid}>{v}</span>
  </div>
);

function MaxCard({ mx }) {
  if (!mx.processable) return (
    <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:p-5 text-sm text-red-700" data-testid="max-stop-reason">
      <AlertTriangle className="h-5 w-5 shrink-0" /><div><p className="font-semibold">Pengajuan tidak dapat diproses</p><p>{mx.stop_reason}</p></div>
    </div>
  );
  const isBsi = mx.bank_key === "bsi_prapen";
  const isAms2 = mx.bank_key === "ams2";

  if (isBsi) {
    return (
      <div className="lp-card p-4 sm:p-6 lp-fade border-l-4 border-l-[#078D67]" data-testid="max-result">
        <p className="lp-eyebrow text-[#078D67]">Hasil Maksimal Pembiayaan BSI • {mx.bank_name || "Bank BSI"}</p>
        <p className="mt-1 font-display text-base sm:text-lg font-bold text-[#17223B]">Calon Debitur: {mx.name}</p>
        <div className="mt-4">
          <MaxRow k="Tanggal Proses" v={fmtDate(mx.process_date)} />
          <MaxRow k="Usia Saat Ini" v={`${mx.age} tahun`} testid="max-age" />
          {mx.bsi_status_gaji_label && (
            <MaxRow k="Status Gaji" v={mx.bsi_status_gaji_label} strong testid="max-status-gaji" />
          )}
          {mx.bsi_sub_product_label && (
            <MaxRow k="Sub-Produk BSI" v={mx.bsi_sub_product_label} testid="max-sub-product" />
          )}
          <MaxRow k="Kategori & Akad" v={mx.category} strong testid="max-category" />
          <MaxRow k="Price / Margin Saat Aktif" v={`${pct(mx.bank_rate)} per tahun`} />
          <MaxRow k="Price / Margin Saat Pensiun" v={`${pct(mx.coop_rate)} per tahun`} testid="max-coop-rate" />
          <MaxRow k="Gaji Masa Aktif Diakui" v={rp(mx.salary)} />
          {mx.pension_salary > 0 && (
            <MaxRow k="Estimasi Gaji Pensiun" v={rp(mx.pension_salary)} />
          )}
          <MaxRow
            k={`Angsuran Maksimal Aktif (DBR ${mx.dbr_active_rate || 70}%)`}
            v={rp(mx.max_installment)}
            strong
            testid="max-installment"
          />
          {mx.max_installment_pension > 0 && (
            <MaxRow k="Angsuran Maksimal Pensiun (DSR 90%)" v={rp(mx.max_installment_pension)} />
          )}
          <MaxRow k="Tenor Maksimal" v={`${mx.max_tenor} bulan`} testid="max-tenor" />
          <MaxRow k="Plafond Maksimal" v={rp(mx.max_plafond)} strong testid="max-plafond" />
          <MaxRow k="Nilai Take Over" v={rp(mx.take_over)} />
        </div>
      </div>
    );
  }

  if (isAms2) {
    return (
      <div className="lp-card p-4 sm:p-6 lp-fade border-l-4 border-l-[#351080]" data-testid="max-result">
        <p className="lp-eyebrow">Hasil Maksimal Simulasi • Koperasi AMS2</p>
        <p className="mt-1 font-display text-base sm:text-lg font-bold text-[#17223B]">Nama Debitur: {mx.name}</p>
        <div className="mt-4">
          <MaxRow k="Tanggal Proses" v={fmtDate(mx.process_date)} />
          <MaxRow k="Usia Saat Ini" v={`${mx.age} tahun ${mx.age_months ? `(${mx.age_months} bln)` : ""}`} testid="max-age" />
          <MaxRow k="Kategori Produk" v={mx.category} strong testid="max-category" />
          <MaxRow k="Bunga Bank" v={`${pct(mx.bank_rate)} per tahun`} />
          <MaxRow k="Bunga Koperasi" v={`${pct(mx.coop_rate)} per tahun`} strong testid="max-coop-rate" />
          <MaxRow k="Cadangan Risiko" v={pct(mx.risk_pct)} />
          <MaxRow k="Gaji Pensiun Bulanan" v={rp(mx.salary)} />
          <MaxRow k="Angsuran Maksimal (90% Gaji)" v={rp(mx.max_installment)} strong testid="max-installment" />
          <MaxRow k="Tenor Maksimal" v={`${mx.max_tenor} bulan`} testid="max-tenor" />
          <MaxRow k="Plafond Maksimal" v={rp(mx.max_plafond)} strong testid="max-plafond" />
          <MaxRow k="Nilai Take Over" v={rp(mx.take_over)} />
        </div>
      </div>
    );
  }

  // Mitra Bank Konvensional
  return (
    <div className="lp-card p-4 sm:p-6 lp-fade border-l-4 border-l-[#17223B]" data-testid="max-result">
      <p className="lp-eyebrow">Hasil Maksimal Kredit • {mx.bank_name || "Mitra Bank"}</p>
      <p className="mt-1 font-display text-base sm:text-lg font-bold text-[#17223B]">Nama Debitur: {mx.name}</p>
      <div className="mt-4">
        <MaxRow k="Tanggal Proses" v={fmtDate(mx.process_date)} />
        <MaxRow k="Usia Saat Ini" v={`${mx.age} tahun`} testid="max-age" />
        <MaxRow k="Kategori Produk" v={mx.category} strong testid="max-category" />
        <MaxRow k="Suku Bunga Kredit" v={`${pct(mx.bank_rate)} per tahun`} strong testid="max-coop-rate" />
        <MaxRow k="Gaji Pensiun Bulanan" v={rp(mx.salary)} />
        <MaxRow k="Angsuran Maksimal" v={rp(mx.max_installment)} strong testid="max-installment" />
        <MaxRow k="Tenor Maksimal" v={`${mx.max_tenor} bulan`} testid="max-tenor" />
        <MaxRow k="Plafond Maksimal" v={rp(mx.max_plafond)} strong testid="max-plafond" />
        <MaxRow k="Nilai Take Over" v={rp(mx.take_over)} />
      </div>
    </div>
  );
}

export default function CalculatorPage() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const leadId = sp.get("lead");
  const [banks, setBanks] = useState([]);
  const [bankKey, setBankKey] = useState("ams2");
  const [dapem, setDapem] = useState("TASPEN");
  const [phone, setPhone] = useState("");
  const [simStatus, setSimStatus] = useState("");
  const bank = banks.find((b) => b.key === bankKey);
  const [d, setD] = useState({
    name: "",
    birth: "",
    salary: "",
    take_over: 0,
    // BSI Specific:
    bsi_status_gaji: "payroll", // "payroll" (Penggajian di BSI) | "non_payroll" (Penggajian tidak di BSI)
    bsi_sub_product: "PP10", // "PP10" (Prapen 10 Tahun (Payroll)) | "PP3" (Prapen 3 Tahun (Non Payroll))
    bsi_akad: "MMQ",
    bsi_skema: "Non-Atribusi",
    bup_age: "58",
    // Variabel BSI Gambar 2:
    nip: "",
    gaji_pokok: "",
    uang_makan: "",
    tunjangan_rutin_1: "",
    tunjangan_rutin_3: "",
    tunjangan_lain_1: "",
    tht: "",
    pension_salary: "",
    tmt_bekerja: "",
    tmt_pensiun_year: "",
  });
  const [mx, setMx] = useState(null);
  const [tl, setTl] = useState("3.5");
  const [mode, setMode] = useState("max");
  const [custom, setCustom] = useState({ plafond: "", tenor: "" });
  const [res, setRes] = useState(null);
  const [sim, setSim] = useState(null);
  const [busy, setBusy] = useState("");

  const handleGajiComponentChange = (field, val) => {
    const updated = { ...d, [field]: val };
    const gp = Number(field === "gaji_pokok" ? val : updated.gaji_pokok || 0);
    const um = Number(field === "uang_makan" ? val : updated.uang_makan || 0);
    const tr1 = Number(field === "tunjangan_rutin_1" ? val : updated.tunjangan_rutin_1 || 0);

    // Hitung total recognized jika ada komponen yang diisi sesuai bobot resmi BSI
    if (gp > 0 || um > 0 || tr1 > 0) {
      const calcTotal = Math.round((gp * 1.0) + (um * 0.9) + (tr1 * 0.9));
      updated.salary = calcTotal;
      if (!updated.pension_salary && gp > 0) {
        updated.pension_salary = Math.round(gp * 0.75);
      }
    }
    setD(updated);
    reset();
  };

  useEffect(() => {
    api.get("/banks").then((r) => {
      setBanks(r.data.banks || []);
      if (r.data.banks?.length && !bankKey) setBankKey(r.data.banks[0].key);
    });
  }, []);

  useEffect(() => {
    if (!leadId) return;
    api.get(`/leads/${leadId}`).then(({ data }) =>
      setD((p) => ({
        ...p,
        name: data.name,
        salary: data.pension_salary || "",
        birth: data.birth_date ? fmtDate(data.birth_date) : "",
      }))
    ).catch(() => toast.error("Leads tidak ditemukan atau bukan milik Anda"));
  }, [leadId]);

  const base = () => ({
    bank_key: bankKey,
    name: d.name,
    birth_date: ddmmyyyyToIso(d.birth),
    salary: Number(d.salary),
    take_over: Number(d.take_over || 0),
    bsi_status_gaji: d.bsi_status_gaji,
    bsi_sub_product: d.bsi_sub_product,
    bsi_akad: d.bsi_akad,
    bsi_skema: d.bsi_skema,
    bup_age: Number(d.bup_age || 58),
    nip: d.nip,
    gaji_pokok: Number(d.gaji_pokok || 0),
    uang_makan: Number(d.uang_makan || 0),
    tunjangan_rutin_1: Number(d.tunjangan_rutin_1 || 0),
    tunjangan_rutin_3: Number(d.tunjangan_rutin_3 || 0),
    tunjangan_lain_1: Number(d.tunjangan_lain_1 || 0),
    tht: Number(d.tht || 0),
    pension_salary: Number(d.pension_salary || 0),
    tmt_bekerja: d.tmt_bekerja,
    tmt_pensiun_year: Number(d.tmt_pensiun_year || 0),
  });

  const reset = () => { setMx(null); setRes(null); setSim(null); setSimStatus(""); };

  const approve = async () => {
    setBusy("approve");
    try {
      const { data } = await api.post(`/simulations/${sim.id}/approve`, { phone: phone || null });
      toast.success(`Pengajuan ${data.app_no} dibuat. Lanjutkan upload dokumen.`);
      nav(`/progress?app=${data.id}`);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(""); }
  };

  const cancel = async () => {
    try {
      await api.post(`/simulations/${sim.id}/cancel`);
      setSimStatus("dibatalkan");
      toast.info("Pengajuan dibatalkan. Simulasi tetap tersimpan.");
    } catch (err) { toast.error(errMsg(err)); }
  };

  const calcMax = async (e) => {
    e.preventDefault();
    if (!ddmmyyyyToIso(d.birth)) return toast.error("Tanggal lahir harus berformat DD/MM/YYYY (contoh: 15/03/1953)");
    setBusy("max"); setRes(null); setSim(null);
    try {
      const { data } = await api.post("/calc/max", base());
      setMx(data);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(""); }
  };

  const isBsi = bankKey === "bsi_prapen";
  const isAms2 = bankKey === "ams2";

  const tlNum = tl === "" ? null : Number(String(tl).replace(",", "."));
  const tlError = isAms2 && tl !== "" && (isNaN(tlNum) || tlNum < 0 || tlNum > 3.5) ? "Tata Laksana tidak boleh negatif atau melebihi 3,5%." : "";

  const payload = () => ({
    ...base(),
    tata_laksana_pct: isAms2 ? tlNum : 0,
    lead_id: leadId || null,
    bank_key: bankKey,
    dapem: dapem || null,
    plafond: mode === "max" ? mx.max_plafond : Number(custom.plafond),
    tenor: mode === "max" ? mx.max_tenor : Number(custom.tenor),
  });

  const calcFinal = async () => {
    if (isAms2 && (tl === "" || tlError)) return toast.error(tlError || "Masukkan persentase Tata Laksana");
    if (mode === "custom" && (!custom.plafond || !custom.tenor)) return toast.error("Lengkapi plafond dan tenor");
    setBusy("final"); setSim(null);
    try {
      const { data } = await api.post("/calc/preview", payload());
      setRes(data);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(""); }
  };

  const save = async () => {
    setBusy("save");
    try {
      const { data } = await api.post("/simulations", payload());
      setSim(data);
      toast.success(`Simulasi ${data.sim_no} tersimpan`);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(""); }
  };

  return (
    <div>
      <div className="lp-card mb-6 flex flex-col gap-4 p-4 sm:gap-6 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Logo size="md" data-testid="calc-header-logo" />
          <div className="sm:border-l sm:border-slate-200 sm:pl-5">
            <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-[#351080]" data-testid="calc-title">LAYANAN PENSIUNAN SuperApps Navigator</h1>
            <p className="text-xs sm:text-sm text-[#078D67]" data-testid="calc-subtitle">Your Business Partner. Growing Together. One Hand Solution.</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-[#078D67]/10 px-3 py-1 text-xs font-semibold text-[#078D67] md:self-center" data-testid="formula-status-badge">
          <ShieldCheck className="h-3.5 w-3.5" />Parameter Mitra Dinamis Aktif
        </span>
      </div>

      <section className="lp-card mb-6 p-4 sm:p-6" data-testid="bank-select-step">
        <p className="lp-eyebrow mb-3">Pilih Bank / Mitra Pembiayaan (7 Mitra Aktif)</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {banks.map((b) => (
            <button
              key={b.key}
              onClick={() => { setBankKey(b.key); reset(); }}
              data-testid={`bank-option-${b.key}`}
              className={`rounded-lg border px-3 py-3 text-left text-sm font-semibold transition-colors ${
                bankKey === b.key
                  ? "border-[#5720B8] bg-[#5720B8]/8 text-[#351080] shadow-sm"
                  : "border-slate-200 text-[#17223B] hover:border-[#5720B8]/40"
              }`}
            >
              {b.name}
              <span className="mt-1 block text-[10px] font-medium text-[#078D67]">
                {b.key === "ams2" ? "Pra/Platinum/Post" : b.key === "bsi_prapen" ? "NOS + Simas Jiwa" : "Parameter Dinamis"}
              </span>
            </button>
          ))}
        </div>

        {bank && (
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <span className="rounded-md bg-[#351080]/8 px-3 py-1.5 font-semibold text-[#351080]" data-testid="segment-badge">
              Mitra Aktif: {bank.full_name || bank.name}
            </span>
            <label className="flex items-center gap-2">Jenis Dapem
              <select value={dapem} onChange={(e) => setDapem(e.target.value)} className="h-9 rounded-md border bg-white px-2" data-testid="dapem-select">
                <option value="TASPEN">TASPEN</option>
                <option value="ASABRI">ASABRI</option>
              </select>
            </label>
          </div>
        )}
      </section>

      {bank && (
        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="space-y-6">
            <Step n="1" title="Data Debitur" testid="calc-step-1">
              <form onSubmit={calcMax} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="c-name">Nama debitur</Label>
                  <Input id="c-name" required className="h-11" value={d.name} onChange={(e) => { setD({ ...d, name: e.target.value }); reset(); }} data-testid="calc-name-input" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-birth">Tanggal lahir (DD/MM/YYYY)</Label>
                  <Input id="c-birth" required placeholder="12/04/1953" className="h-11 lp-num" value={d.birth} onChange={(e) => { setD({ ...d, birth: e.target.value }); reset(); }} data-testid="calc-birth-input" />
                </div>
                <div className="space-y-1.5">
                  <Label>{isBsi ? "Penghasilan Aktif Diakui" : "Gaji per bulan"}</Label>
                  <CurrencyInput required value={d.salary} onChange={(v) => { setD({ ...d, salary: v }); reset(); }} data-testid="calc-salary-input" />
                  {isBsi && (
                    <p className="text-[11px] text-slate-500">
                      Terhitung otomatis bila mengisi rincian di bawah (Gaji Pokok 100% + Uang Makan 90% + Tunjangan Rutin 90%), atau isi langsung.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Nilai Take Over (TO)</Label>
                  <CurrencyInput value={d.take_over} onChange={(v) => { setD({ ...d, take_over: v }); reset(); }} data-testid="calc-takeover-input" />
                </div>

                {bankKey === "bsi_prapen" && (
                  <div className="space-y-3.5 rounded-xl border border-[#078D67]/30 bg-[#078D67]/[0.04] p-4">
                    <div className="flex items-center justify-between border-b border-[#078D67]/15 pb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#078D67]">
                        Opsi Khusus BSI Prapensiun (NOS v1.4.6 + Simas Jiwa)
                      </p>
                      <span className="rounded bg-[#078D67]/10 px-2 py-0.5 text-[10px] font-bold text-[#078D67]">
                        {d.bsi_status_gaji === "payroll" ? "DBR 70% • Max 10 Thn" : "DBR 50% • Max 3 Thn"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      {/* Atribut Status Gaji (User Requested) */}
                      <div className="col-span-2 sm:col-span-1">
                        <Label className="text-xs font-bold text-[#17223B]">Status Gaji</Label>
                        <select
                          className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 font-semibold text-[#351080]"
                          value={d.bsi_status_gaji}
                          onChange={(e) => {
                            const stat = e.target.value;
                            const sub = stat === "payroll" ? "PP10" : "PP3";
                            setD({ ...d, bsi_status_gaji: stat, bsi_sub_product: sub });
                            reset();
                          }}
                          data-testid="bsi-status-gaji-select"
                        >
                          <option value="payroll">Payroll (Penggajian di BSI)</option>
                          <option value="non_payroll">Non Payroll (Penggajian Tidak di BSI)</option>
                        </select>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {d.bsi_status_gaji === "payroll" ? "Penggajian aktif di BSI (DBR 70%)" : "Penggajian tidak di BSI (DBR 50%)"}
                        </p>
                      </div>

                      {/* Sub-Produk BSI (Sesuai Gambar 2: Prapen 10 Tahun / Prapen 3 Tahun) */}
                      <div className="col-span-2 sm:col-span-1">
                        <Label className="text-xs font-bold text-[#17223B]">Sub-Produk BSI</Label>
                        <select
                          className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 font-medium"
                          value={d.bsi_sub_product}
                          onChange={(e) => {
                            const sub = e.target.value;
                            const stat = sub === "PP3" ? "non_payroll" : "payroll";
                            setD({ ...d, bsi_sub_product: sub, bsi_status_gaji: stat });
                            reset();
                          }}
                          data-testid="bsi-sub-product-select"
                        >
                          <option value="PP10">Prapen 10 Tahun (Payroll)</option>
                          <option value="PP3">Prapen 3 Tahun (Non Payroll)</option>
                        </select>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {d.bsi_sub_product === "PP10" ? "Masa aktif maks. 10 thn (Dekade Berkah)" : "Masa aktif maks. 3 thn (Tri Berkah)"}
                        </p>
                      </div>

                      <div>
                        <Label className="text-xs">Jenis Akad</Label>
                        <select
                          className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 font-medium"
                          value={d.bsi_akad}
                          onChange={(e) => { setD({ ...d, bsi_akad: e.target.value }); reset(); }}
                          data-testid="bsi-akad-select"
                        >
                          <option value="MMQ">MMQ (Musyarakah Mutanaqishah)</option>
                          <option value="Murabahah">Murabahah</option>
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs">Skema Margin</Label>
                        <select
                          className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 font-medium"
                          value={d.bsi_skema}
                          onChange={(e) => { setD({ ...d, bsi_skema: e.target.value }); reset(); }}
                          data-testid="bsi-skema-select"
                        >
                          <option value="Atribusi">Atribusi</option>
                          <option value="Non-Atribusi">Non-Atribusi</option>
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs">Usia BUP Pensiun</Label>
                        <select
                          className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 font-medium"
                          value={d.bup_age}
                          onChange={(e) => { setD({ ...d, bup_age: e.target.value }); reset(); }}
                          data-testid="bsi-bup-age-select"
                        >
                          <option value="58">58 Tahun (Reguler)</option>
                          <option value="60">60 Tahun (Guru/Dosen/Struktural)</option>
                          <option value="65">65 Tahun (Hakim/Spesialis)</option>
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs">Tahun TMT Pensiun (BUP)</Label>
                        <Input
                          type="number"
                          placeholder="Contoh: 2036"
                          className="mt-1 h-9 w-full text-xs"
                          value={d.tmt_pensiun_year}
                          onChange={(e) => { setD({ ...d, tmt_pensiun_year: e.target.value }); reset(); }}
                          data-testid="bsi-tmt-pensiun-input"
                        />
                      </div>
                    </div>

                    {/* Section Variabel Detail NOS Sesuai Gambar 2 */}
                    <div className="mt-3 rounded-lg border border-slate-200/80 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-[#17223B]">Rincian Komponen Gaji &amp; Variabel NOS (Gambar 2)</p>
                        <span className="text-[10px] text-[#078D67] font-semibold">Semua variabel diinput di awal</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Input rincian di bawah ini akan menghitung otomatis Total Gaji Diakui sesuai bobot resmi BSI.
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs">
                        <div className="col-span-2 sm:col-span-1">
                          <Label className="text-[11px]">NIP Calon Debitur</Label>
                          <Input
                            placeholder="1968012220071012004"
                            className="mt-1 h-9 text-xs font-mono"
                            value={d.nip}
                            onChange={(e) => setD({ ...d, nip: e.target.value })}
                            data-testid="bsi-nip-input"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <Label className="text-[11px]">THT (Tabungan Hari Tua)</Label>
                          <CurrencyInput
                            value={d.tht}
                            onChange={(v) => setD({ ...d, tht: v })}
                            className="mt-1 h-9 text-xs"
                            placeholder="Contoh: 78.600.000"
                            data-testid="bsi-tht-input"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px]">Gaji Pokok (100%)</Label>
                          <CurrencyInput
                            value={d.gaji_pokok}
                            onChange={(v) => handleGajiComponentChange("gaji_pokok", v)}
                            className="mt-1 h-9 text-xs"
                            placeholder="Contoh: 4.254.800"
                            data-testid="bsi-gaji-pokok-input"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px]">Uang Makan (90%)</Label>
                          <CurrencyInput
                            value={d.uang_makan}
                            onChange={(v) => handleGajiComponentChange("uang_makan", v)}
                            className="mt-1 h-9 text-xs"
                            placeholder="Contoh: 550.000"
                            data-testid="bsi-uang-makan-input"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px]">Tunjangan Rutin 1 Bln (90%)</Label>
                          <CurrencyInput
                            value={d.tunjangan_rutin_1}
                            onChange={(v) => handleGajiComponentChange("tunjangan_rutin_1", v)}
                            className="mt-1 h-9 text-xs"
                            placeholder="Contoh: 3.761.240"
                            data-testid="bsi-tunjangan-1-input"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px]">Estimasi Pensiun Bulanan</Label>
                          <CurrencyInput
                            value={d.pension_salary}
                            onChange={(v) => setD({ ...d, pension_salary: v })}
                            className="mt-1 h-9 text-xs"
                            placeholder="Contoh: 4.600.000"
                            data-testid="bsi-pension-salary-input"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <CtaButton type="submit" className="h-11 w-full font-semibold" disabled={busy === "max"} data-testid="calc-max-button">
                  {busy === "max" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hitung Hasil Maksimal"}
                </CtaButton>
              </form>
            </Step>

            {mx?.processable && (
              <Step
                n="2"
                title={
                  isBsi
                    ? "Plafond & Tenor Pembiayaan BSI"
                    : isAms2
                    ? "Tata Laksana, Plafond & Tenor Koperasi"
                    : `Plafond & Tenor Kredit ${bank.name}`
                }
                testid="calc-step-2"
              >
                <div className="space-y-5">
                  {isBsi ? (
                    <div className="rounded-lg border border-[#078D67]/20 bg-[#078D67]/5 p-3 text-xs text-[#078D67]">
                      <p className="font-semibold">Ketentuan Biaya BSI NOS v1.4.6:</p>
                      <p className="mt-0.5 text-slate-600">
                        Biaya ADM 1% • Asuransi Simas Jiwa Syariah • Materai Rp100.000 • Blokir Angsuran (1× aktif + 2× pensiun). Tanpa biaya Tata Laksana.
                      </p>
                    </div>
                  ) : isAms2 ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="c-tl">Tata Laksana (%)</Label>
                      <Input
                        id="c-tl"
                        inputMode="decimal"
                        placeholder="0 – 3,5"
                        className="h-11"
                        value={tl}
                        onChange={(e) => { setTl(e.target.value); setRes(null); setSim(null); }}
                        data-testid="calc-tl-input"
                      />
                      <p className={`text-xs ${tlError ? "text-red-600" : "text-slate-500"}`} data-testid="calc-tl-hint">
                        {tlError || "Standar maksimal Tata Laksana adalah 3,5% dari plafond pengajuan. Tidak boleh negatif."}
                      </p>
                    </div>
                  ) : null}

                  <RadioGroup value={mode} onValueChange={(v) => { setMode(v); setRes(null); setSim(null); }} className="gap-3">
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-[#5720B8]"><RadioGroupItem value="max" data-testid="calc-mode-max" />Gunakan plafond &amp; tenor maksimal</label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-[#5720B8]"><RadioGroupItem value="custom" data-testid="calc-mode-custom" />Tentukan plafond &amp; tenor sendiri</label>
                  </RadioGroup>
                  {mode === "custom" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 space-y-1.5"><Label>Plafond</Label><CurrencyInput value={custom.plafond} onChange={(v) => { setCustom({ ...custom, plafond: v }); setRes(null); }} data-testid="calc-plafond-input" /></div>
                      <div className="space-y-1.5"><Label htmlFor="c-tenor">Tenor (bulan)</Label><Input id="c-tenor" inputMode="numeric" className="h-11" value={custom.tenor} onChange={(e) => { setCustom({ ...custom, tenor: e.target.value.replace(/\D/g, "") }); setRes(null); }} data-testid="calc-tenor-input" /></div>
                    </div>
                  )}
                  <Button onClick={calcFinal} disabled={busy === "final"} className="h-11 w-full bg-[#351080] font-semibold hover:bg-[#2a0c66]" data-testid="calc-final-button">
                    {busy === "final" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hitung Simulasi Final"}
                  </Button>
                </div>
              </Step>
            )}
          </div>

          <div className="space-y-6">
            {!mx && (
              <div className="lp-card flex min-h-[320px] flex-col items-center justify-center p-10 text-center">
                <Logo variant="vertical" size="sm" className="opacity-90" />
                <p className="mt-6 max-w-sm text-sm text-slate-500">Masukkan nama, tanggal lahir (DD/MM/YYYY), gaji per bulan, dan nilai Take Over untuk memulai simulasi pada mitra <b>{bank.full_name}</b>.</p>
              </div>
            )}
            {mx && <MaxCard mx={mx} />}
            {res && (
              <div className="lp-card p-6 lp-fade">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="lp-eyebrow">{res.bank_name || "Your Business Partner. Growing Together."}</p>
                    <h2 className="font-display text-xl font-bold text-[#17223B]">Hasil Simulasi Final</h2>
                  </div>
                  {sim && <span className="rounded-md bg-[#351080]/8 px-3 py-1 text-sm font-semibold text-[#351080]" data-testid="sim-number">{sim.sim_no}</span>}
                </div>
                {!res.overall_ok && (
                  <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="final-issues">
                    <p className="font-semibold">Pengajuan belum sesuai ketentuan. Mohon koreksi nilai pengajuan:</p>
                    <ul className="mt-1 list-disc pl-5">{res.issues.map((i) => <li key={i}>{i}</li>)}</ul>
                  </div>
                )}
                <ResultView r={res} />
                <div className="mt-6 space-y-4">
                  {res.overall_ok && !sim && (
                    <CtaButton onClick={save} disabled={busy === "save"} className="h-11 w-full font-semibold" data-testid="calc-save-button">
                      {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Simpan Simulasi</>}
                    </CtaButton>
                  )}
                  {sim && (
                    <>
                      <DownloadActions sim={sim} />
                      <div className="rounded-xl border border-[#351080]/15 p-4" data-testid="sim-approval-panel">
                        <p className="font-display text-sm font-bold text-[#351080]">Persetujuan Simulasi</p>
                        {simStatus === "dibatalkan" ? (
                          <p className="mt-2 text-sm text-slate-500" data-testid="sim-cancelled">Pengajuan dibatalkan.</p>
                        ) : (
                          <>
                            {!leadId && (
                              <div className="mt-3 max-w-xs space-y-1.5">
                                <Label htmlFor="c-phone">No. telepon calon debitur (untuk data leads)</Label>
                                <Input id="c-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="approve-phone-input" />
                              </div>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button onClick={approve} disabled={busy === "approve"} className="bg-[#078D67] hover:bg-[#067556]" data-testid="approve-sim-button">Setujui Simulasi &amp; Lanjut Pengajuan</Button>
                              <Button variant="outline" onClick={cancel} className="text-red-600" data-testid="cancel-sim-button">Batalkan Pengajuan</Button>
                            </div>
                          </>
                        )}
                      </div>
                      <AiSummary sim={sim} />
                    </>
                  )}
                  <Button variant="ghost" onClick={() => { setD({ ...d, name: "", birth: "", salary: "", take_over: 0 }); setTl("3.5"); setMode("max"); setCustom({ plafond: "", tenor: "" }); reset(); }} data-testid="calc-reset-button">
                    <RotateCcw className="mr-2 h-4 w-4" />Simulasi baru
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

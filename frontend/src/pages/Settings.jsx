import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Download, Upload, ShieldCheck, Save, RotateCcw, CheckCircle2, XCircle, Sliders, LogOut } from "lucide-react";
import { api, errMsg, downloadFile } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { rp, ROLE_LABEL } from "../lib/format";
import { PageHeader, CtaButton } from "../components/common";
import { PartnerLogo } from "../components/brand/Logo";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";

const PARTNER_KEYS = [
  "ams2",
  "bsi_prapen",
  "bank_capital",
  "bank_mestika",
  "bank_mantap",
  "bank_mnc",
  "bank_bni",
];

function DynamicPartnerParams({ user }) {
  const [data, setData] = useState(null);
  const [selectedKey, setSelectedKey] = useState("ams2");
  const [draft, setDraft] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const canEdit = user.role === "super_admin" || user.role === "admin_ops";

  const load = useCallback(() => {
    api.get("/calc/params").then((r) => {
      setData(r.data);
      const p = r.data.partners?.[selectedKey];
      if (p) setDraft(structuredClone(p));
    });
  }, [selectedKey]);

  useEffect(() => { load(); }, [load]);

  const selectPartner = (k) => {
    setSelectedKey(k);
    if (data?.partners?.[k]) {
      setDraft(structuredClone(data.partners[k]));
    }
  };

  const setNum = (field, val) => {
    setDraft((prev) => ({ ...prev, [field]: Number(val) }));
  };

  const setTierNum = (idx, field, val) => {
    setDraft((prev) => {
      const nextTiers = prev.tiers.map((t, i) => (i === idx ? { ...t, [field]: Number(val) } : t));
      return { ...prev, tiers: nextTiers };
    });
  };

  const saveParams = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: res } = await api.put(`/calc/params/${selectedKey}`, {
        updates: draft,
        reason: reason || `Penyesuaian aturan mitra ${draft.shortName}`,
      });
      toast.success(res.message);
      setReason("");
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const decideProposal = async (id, decision) => {
    try {
      await api.post(`/calc/params/proposals/${id}/decide`, { decision });
      toast.success(decision === "APPROVE" ? "Usulan parameter disetujui & diterapkan" : "Usulan parameter ditolak");
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const resetAll = async () => {
    if (!window.confirm("Reset seluruh parameter 7 mitra bank ke nilai default awal?")) return;
    try {
      await api.post("/calc/params/reset");
      toast.success("Seluruh parameter mitra dikembalikan ke standar awal");
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  if (!data || !draft) return null;

  return (
    <div className="space-y-6">
      <section className="lp-card p-6" data-testid="calc-params-panel">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="lp-eyebrow flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5" /> Multi-Partner Dynamic Engine
            </p>
            <h2 className="font-display text-lg font-bold text-[#17223B]">Parameter Aturan Mitra Bank (Dinamis)</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-[#078D67]/10 px-2.5 py-1 text-xs font-semibold text-[#078D67]">
              <ShieldCheck className="h-3.5 w-3.5" /> {data.formula_version} • {ROLE_LABEL[user.role]}
            </span>
            {user.role === "super_admin" && (
              <Button size="sm" variant="outline" onClick={resetAll} data-testid="reset-params-button">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset Default
              </Button>
            )}
          </div>
        </div>

        <p className="mb-4 text-xs text-slate-500">
          Pilih mitra bank di bawah ini untuk melihat atau menyesuaikan suku bunga, batas usia, tenor, plafon maksimal, DSR/DBR, serta komponen biaya.
          {user.role === "super_admin"
            ? " Sebagai Super Admin, perubahan Anda langsung aktif di kalkulator."
            : user.role === "admin_ops"
            ? " Sebagai Admin Operasional, perubahan Anda akan dikirim sebagai usulan (Dual Control) ke Super Admin."
            : " Sebagai Marketing, Anda memiliki akses baca (View Only) pada parameter aktif."}
        </p>

        <div className="mb-6 flex gap-2.5 border-b border-slate-100 pb-4 lp-scroll-x -mx-4 px-4 sm:mx-0 sm:px-0">
          {PARTNER_KEYS.map((k) => {
            const item = data.partners?.[k];
            if (!item) return null;
            const isSelected = selectedKey === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => selectPartner(k)}
                data-testid={`param-tab-${k}`}
                className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  isSelected
                    ? "border-[#351080] bg-[#351080] text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-[#351080]/40 hover:bg-slate-50"
                }`}
              >
                <PartnerLogo bankKey={k} size="xs" className={isSelected ? "ring-2 ring-white/50" : ""} />
                <span>{item.shortName}</span>
                {item.active === false && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                      isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    Nonaktif
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <form onSubmit={saveParams} className="space-y-5">
          <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4">
            <PartnerLogo bankKey={selectedKey} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display text-base font-bold text-[#17223B]">{draft.name}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    draft.active !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {draft.active !== false ? "Aktif" : "Menunggu Rumus"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{draft.description}</p>
            </div>
          </div>

          {/* 1. KOPERASI AMS2 */}
          {selectedKey === "ams2" && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {draft.tiers?.map((t, idx) => (
                  <div key={t.id} className="rounded-xl border border-[#5720B8]/20 bg-white p-4">
                    <p className="font-display font-bold text-[#351080]">{t.name}</p>
                    <p className="mb-3 text-xs text-slate-500">Usia {t.minAge} – {t.maxAge} tahun</p>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Bunga Koperasi (% p.a.)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          disabled={!canEdit}
                          value={t.coopRateAnnual}
                          onChange={(e) => setTierNum(idx, "coopRateAnnual", e.target.value)}
                          className="h-9 lp-num"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Cadangan Risiko (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          disabled={!canEdit}
                          value={t.riskReserveRate}
                          onChange={(e) => setTierNum(idx, "riskReserveRate", e.target.value)}
                          className="h-9 lp-num"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div><Label>Bunga Bank (% p.a.)</Label><Input type="number" step="0.1" disabled={!canEdit} value={draft.bankRateAnnual} onChange={(e) => setNum("bankRateAnnual", e.target.value)} className="lp-num" /></div>
                <div><Label>Rasio Angsuran Maks (%)</Label><Input type="number" step="0.5" disabled={!canEdit} value={draft.maxInstallmentRatio} onChange={(e) => setNum("maxInstallmentRatio", e.target.value)} className="lp-num" /></div>
                <div><Label>Plafond Maksimal (Rp)</Label><Input type="number" step="1000000" disabled={!canEdit} value={draft.maxPlafondAbsolute} onChange={(e) => setNum("maxPlafondAbsolute", e.target.value)} className="lp-num" /></div>
                <div><Label>Tenor Maksimal (Bulan)</Label><Input type="number" disabled={!canEdit} value={draft.maxTenorMonths} onChange={(e) => setNum("maxTenorMonths", e.target.value)} className="lp-num" /></div>
                <div><Label>Batas Usia Masuk (Tahun)</Label><Input type="number" disabled={!canEdit} value={draft.maxEntryAgeYears} onChange={(e) => setNum("maxEntryAgeYears", e.target.value)} className="lp-num" /></div>
                <div><Label>Biaya PROAQ (%)</Label><Input type="number" step="0.1" disabled={!canEdit} value={draft.proaqRate} onChange={(e) => setNum("proaqRate", e.target.value)} className="lp-num" /></div>
                <div><Label>Biaya Administrasi (Rp)</Label><Input type="number" step="50000" disabled={!canEdit} value={draft.adminFee} onChange={(e) => setNum("adminFee", e.target.value)} className="lp-num" /></div>
                <div><Label>Tata Laksana Maks (%)</Label><Input type="number" step="0.1" disabled={!canEdit} value={draft.tataLaksanaMax} onChange={(e) => setNum("tataLaksanaMax", e.target.value)} className="lp-num" /></div>
                <div><Label>Retensi Angsuran (×)</Label><Input type="number" disabled={!canEdit} value={draft.retentionMultiplier} onChange={(e) => setNum("retentionMultiplier", e.target.value)} className="lp-num" /></div>
              </div>
            </>
          )}

          {/* 2. BSI PRAPENSIUN + SIMAS JIWA */}
          {selectedKey === "bsi_prapen" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div><Label>Plafond Maksimal BSI (Rp)</Label><Input type="number" step="10000000" disabled={!canEdit} value={draft.maxPlafondAbsolute} onChange={(e) => setNum("maxPlafondAbsolute", e.target.value)} className="lp-num" /></div>
              <div><Label>Tenor Maksimal (Bulan)</Label><Input type="number" disabled={!canEdit} value={draft.maxTenorMonths} onChange={(e) => setNum("maxTenorMonths", e.target.value)} className="lp-num" /></div>
              <div><Label>DBR Saat Aktif Payroll (%)</Label><Input type="number" step="0.5" disabled={!canEdit} value={draft.dbrActivePayroll} onChange={(e) => setNum("dbrActivePayroll", e.target.value)} className="lp-num" /></div>
              <div><Label>DSR Saat Pensiun Maks (%)</Label><Input type="number" step="0.5" disabled={!canEdit} value={draft.dsrPensionMax} onChange={(e) => setNum("dsrPensionMax", e.target.value)} className="lp-num" /></div>
              <div><Label>Usia Jatuh Tempo Maks (Thn)</Label><Input type="number" disabled={!canEdit} value={draft.maxEndAgeYears} onChange={(e) => setNum("maxEndAgeYears", e.target.value)} className="lp-num" /></div>
              <div><Label>Default Usia BUP (Thn)</Label><Input type="number" disabled={!canEdit} value={draft.bupAgeDefault} onChange={(e) => setNum("bupAgeDefault", e.target.value)} className="lp-num" /></div>
            </div>
          )}

          {/* 2b. TIGA BERMUDA AMANAH • BANK MESTIKA (TBA-MSTK 1.0) */}
          {selectedKey === "bank_mestika" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div><Label>Bunga Reguler &lt; 65 Thn (% p.a.)</Label><Input type="number" step="0.1" disabled={!canEdit} value={draft.interestRateAnnual} onChange={(e) => setNum("interestRateAnnual", e.target.value)} className="lp-num" data-testid="param-interest-input" /></div>
              <div><Label>Bunga Reguler Plus &lt; 69 Thn (% p.a.)</Label><Input type="number" step="0.1" disabled={!canEdit} value={draft.interestRatePlusAnnual ?? 12} onChange={(e) => setNum("interestRatePlusAnnual", e.target.value)} className="lp-num" /></div>
              <div><Label>DSR Gaji Pokok / IDPB (%)</Label><Input type="number" step="0.5" disabled={!canEdit} value={draft.maxInstallmentRatio} onChange={(e) => setNum("maxInstallmentRatio", e.target.value)} className="lp-num" /></div>
              <div><Label>Potongan Estimasi Gaji Pokok (%)</Label><Input type="number" step="0.5" disabled={!canEdit} value={draft.pensionDeductionPercent ?? 13} onChange={(e) => setNum("pensionDeductionPercent", e.target.value)} className="lp-num" /></div>
              <div><Label>Batas Plafond Maksimal (Rp)</Label><Input type="number" step="10000000" disabled={!canEdit} value={draft.maxPlafondAbsolute} onChange={(e) => setNum("maxPlafondAbsolute", e.target.value)} className="lp-num" /></div>
              <div><Label>Tenor Maksimal (Bulan)</Label><Input type="number" disabled={!canEdit} value={draft.maxTenorMonths} onChange={(e) => setNum("maxTenorMonths", e.target.value)} className="lp-num" /></div>
              <div><Label>Batas Usia Reguler (&lt; Thn)</Label><Input type="number" disabled={!canEdit} value={draft.regulerMaxAgeYears ?? 65} onChange={(e) => setNum("regulerMaxAgeYears", e.target.value)} className="lp-num" /></div>
              <div><Label>Batas Usia Masuk (&lt; Thn)</Label><Input type="number" disabled={!canEdit} value={draft.maxEntryAgeYears} onChange={(e) => setNum("maxEntryAgeYears", e.target.value)} className="lp-num" /></div>
              <div><Label>Usia Akhir Kredit (Tahun)</Label><Input type="number" disabled={!canEdit} value={draft.maxEndAgeYears} onChange={(e) => setNum("maxEndAgeYears", e.target.value)} className="lp-num" /></div>
              <div><Label>Usia Akhir Kredit (+ Bulan)</Label><Input type="number" min="0" max="11" disabled={!canEdit} value={draft.maxEndAgeMonths ?? 11} onChange={(e) => setNum("maxEndAgeMonths", e.target.value)} className="lp-num" /></div>
              <div><Label>Biaya Pencairan (%)</Label><Input type="number" step="0.5" disabled={!canEdit} value={draft.disbursementCostPercent ?? 22} onChange={(e) => { setNum("disbursementCostPercent", e.target.value); setNum("provisionRatePercent", e.target.value); }} className="lp-num" /></div>
              <div><Label>Retensi Angsuran (×)</Label><Input type="number" disabled={!canEdit} value={draft.retentionMultiplier} onChange={(e) => setNum("retentionMultiplier", e.target.value)} className="lp-num" /></div>
            </div>
          )}

          {/* 3. MITRA BANK KONVENSIONAL */}
          {selectedKey !== "ams2" && selectedKey !== "bsi_prapen" && selectedKey !== "bank_mestika" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div><Label>Suku Bunga (% per tahun)</Label><Input type="number" step="0.05" disabled={!canEdit} value={draft.interestRateAnnual} onChange={(e) => setNum("interestRateAnnual", e.target.value)} className="lp-num" data-testid="param-interest-input" /></div>
              <div><Label>DSR / Rasio Angsuran Maks (%)</Label><Input type="number" step="0.5" disabled={!canEdit} value={draft.maxInstallmentRatio} onChange={(e) => setNum("maxInstallmentRatio", e.target.value)} className="lp-num" /></div>
              <div><Label>Plafond Maksimal (Rp)</Label><Input type="number" step="5000000" disabled={!canEdit} value={draft.maxPlafondAbsolute} onChange={(e) => setNum("maxPlafondAbsolute", e.target.value)} className="lp-num" /></div>
              <div><Label>Tenor Maksimal (Bulan)</Label><Input type="number" disabled={!canEdit} value={draft.maxTenorMonths} onChange={(e) => setNum("maxTenorMonths", e.target.value)} className="lp-num" /></div>
              <div><Label>Usia Masuk Maksimal (Thn)</Label><Input type="number" disabled={!canEdit} value={draft.maxEntryAgeYears} onChange={(e) => setNum("maxEntryAgeYears", e.target.value)} className="lp-num" /></div>
              <div><Label>Usia Lunas Maksimal (Thn)</Label><Input type="number" disabled={!canEdit} value={draft.maxEndAgeYears} onChange={(e) => setNum("maxEndAgeYears", e.target.value)} className="lp-num" /></div>
              <div><Label>Biaya Provisi (%)</Label><Input type="number" step="0.1" disabled={!canEdit} value={draft.provisionRatePercent} onChange={(e) => setNum("provisionRatePercent", e.target.value)} className="lp-num" /></div>
              <div><Label>Tarif Asuransi / Risiko (%)</Label><Input type="number" step="0.1" disabled={!canEdit} value={draft.insuranceRatePercent} onChange={(e) => setNum("insuranceRatePercent", e.target.value)} className="lp-num" /></div>
              <div><Label>Biaya Administrasi (Rp)</Label><Input type="number" step="50000" disabled={!canEdit} value={draft.adminFee} onChange={(e) => setNum("adminFee", e.target.value)} className="lp-num" /></div>
              <div><Label>Retensi Angsuran (×)</Label><Input type="number" disabled={!canEdit} value={draft.retentionMultiplier} onChange={(e) => setNum("retentionMultiplier", e.target.value)} className="lp-num" /></div>
            </div>
          )}

          {canEdit && (
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
              {user.role === "admin_ops" && (
                <div className="flex-1">
                  <Label>Catatan alasan perubahan parameter (Dual Control)</Label>
                  <Input
                    required
                    placeholder="Contoh: Penyesuaian surat edaran mitra bank terbaru..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              )}
              <CtaButton type="submit" disabled={busy} data-testid="save-partner-params-button">
                <Save className="mr-2 h-4 w-4" />
                {user.role === "super_admin" ? "Simpan & Terapkan Parameter" : "Ajukan Perubahan ke Super Admin"}
              </CtaButton>
            </div>
          )}
        </form>
      </section>

      {/* DAFTAR USULAN PERUBAHAN PARAMETER (DUAL CONTROL) */}
      {data.proposals?.length > 0 && (
        <section className="lp-card p-6" data-testid="param-proposals-panel">
          <h3 className="font-display text-base font-bold text-[#17223B]">Usulan Perubahan Parameter (Dual Control)</h3>
          <p className="mt-1 text-xs text-slate-500">Daftar pengajuan perubahan parameter dari Admin Operasional yang memerlukan persetujuan Super Admin.</p>
          <ul className="mt-4 divide-y">
            {data.proposals.map((prop) => (
              <li key={prop.id} className="flex flex-col justify-between gap-3 py-3 text-sm sm:flex-row sm:items-center">
                <div>
                  <p className="font-semibold text-[#351080]">{prop.partner_name}</p>
                  <p className="text-xs text-slate-600">{prop.reason}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Diusulkan oleh {prop.proposed_by_name} • Status: <b>{prop.status}</b></p>
                </div>
                {user.role === "super_admin" && prop.status === "PENDING" && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" className="bg-[#078D67] hover:bg-[#067556]" onClick={() => decideProposal(prop.id, "APPROVE")} data-testid={`approve-prop-${prop.id}`}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Setujui
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => decideProposal(prop.id, "REJECT")} data-testid={`reject-prop-${prop.id}`}>
                      <XCircle className="mr-1.5 h-3.5 w-3.5" /> Tolak
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ChangePassword() {
  const [v, setV] = useState({ current_password: "", new_password: "" });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/change-password", v);
      toast.success("Kata sandi diperbarui");
      setV({ current_password: "", new_password: "" });
    } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <form onSubmit={submit} className="lp-card space-y-4 p-6" data-testid="change-password-form">
      <h2 className="font-display font-bold">Ubah Kata Sandi</h2>
      <div className="space-y-1.5"><Label htmlFor="cp1">Kata sandi saat ini</Label><Input id="cp1" type="password" required value={v.current_password} onChange={(e) => setV({ ...v, current_password: e.target.value })} data-testid="current-password-input" /></div>
      <div className="space-y-1.5"><Label htmlFor="cp2">Kata sandi baru (min. 8)</Label><Input id="cp2" type="password" required minLength={8} value={v.new_password} onChange={(e) => setV({ ...v, new_password: e.target.value })} data-testid="new-password-input" /></div>
      <Button type="submit" className="bg-[#351080] hover:bg-[#2a0c66]" data-testid="change-password-submit">Simpan</Button>
    </form>
  );
}

function Backup() {
  const ref = useRef();
  const restore = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/backup/restore", fd);
      toast.success(`Dipulihkan: ${Object.values(data.restored).reduce((a, b) => a + b, 0)} data`);
    } catch (e) { toast.error(errMsg(e)); } finally { ref.current.value = ""; }
  };
  return (
    <section className="lp-card space-y-4 p-6" data-testid="backup-panel">
      <h2 className="font-display font-bold">Backup &amp; Pemulihan</h2>
      <p className="text-sm text-slate-500">Unduh salinan JSON seluruh leads, aktivitas, simulasi, parameter mitra, dan audit log. Pemulihan menggabungkan data berdasarkan ID.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => downloadFile("/backup", "backup.json")} data-testid="backup-download-button"><Download className="mr-2 h-4 w-4" />Unduh Backup</Button>
        <input ref={ref} type="file" accept=".json" className="hidden" onChange={(e) => restore(e.target.files[0])} data-testid="restore-file-input" />
        <Button variant="outline" onClick={() => ref.current.click()} data-testid="restore-button"><Upload className="mr-2 h-4 w-4" />Pulihkan dari File</Button>
      </div>
    </section>
  );
}

function AccountLogout({ user }) {
  const { logout } = useAuth();
  const nav = useNavigate();
  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <section className="lp-card space-y-4 p-6" data-testid="account-logout-panel">
      <h2 className="font-display font-bold">Akun &amp; Sesi Aktif</h2>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#351080] text-sm font-bold text-white">
          {user.name?.[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#5720B8]">{ROLE_LABEL[user.role]}</p>
        </div>
      </div>
      <Button
        variant="destructive"
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 font-bold"
        data-testid="settings-logout-btn"
      >
        <LogOut className="h-4 w-4" />
        <span>Keluar dari Akun (Logout)</span>
      </Button>
    </section>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  return (
    <div>
      <PageHeader eyebrow="Pengaturan & Parameter Mitra" title="Pengaturan Enterprise" desc="Kelola parameter aturan mitra bank secara dinamis, keamanan akun, dan pencadangan database." />
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <DynamicPartnerParams user={user} />
        <div className="space-y-6">
          <AccountLogout user={user} />
          <ChangePassword />
          {user.role === "super_admin" && <Backup />}
        </div>
      </div>
    </div>
  );
}

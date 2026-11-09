import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Download, Upload, ShieldCheck, Save, RotateCcw, CheckCircle2, XCircle, Sliders, LogOut, User, Smartphone } from "lucide-react";
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

const BSI_SUB_PRODUCTS = [
  { code: "PP3", label: "TriBerkah / PP3", subtitle: "Prapensiun ≤ 3 Tahun (Maks 240 bln • 74 thn 6 bln)" },
  { code: "PP10", label: "Dekade / PP10", subtitle: "Prapensiun ≤ 10 Tahun (Maks 180 bln • 74 thn 4 bln)" },
  { code: "PENSIUN", label: "Pensiun Berkah", subtitle: "Pensiun Murni / Janda (Maks 180 bln • 74 thn 6 bln)" },
];

function splitMonthsToYm(totalMonths) {
  const m = Number.isInteger(Number(totalMonths)) && Number(totalMonths) >= 0 ? Number(totalMonths) : 892;
  return {
    years: Math.floor(m / 12),
    months: m % 12,
  };
}

function DynamicPartnerParams({ user }) {
  const [data, setData] = useState(null);
  const [selectedKey, setSelectedKey] = useState("ams2");
  const [selectedBsiProduct, setSelectedBsiProduct] = useState("PP3");
  const [draft, setDraft] = useState(null);
  const [bsiProductDraft, setBsiProductDraft] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const canEdit = user.role === "super_admin" || user.role === "admin_ops";

  const hydrateBsiProductDraft = useCallback((partnerObj, prodCode) => {
    const prod = partnerObj?.products?.[prodCode];
    if (!prod) {
      setBsiProductDraft(null);
      return;
    }
    const cloned = structuredClone(prod);
    const ym = splitMonthsToYm(cloned.loan?.maxMaturityAgeMonths);
    cloned._endAgeYears = ym.years;
    cloned._endAgeMonths = ym.months;
    setBsiProductDraft(cloned);
  }, []);

  const load = useCallback(() => {
    api.get("/calc/params").then((r) => {
      setData(r.data);
      const p = r.data.partners?.[selectedKey];
      if (p) {
        setDraft(structuredClone(p));
        if (selectedKey === "bsi_prapen") {
          hydrateBsiProductDraft(p, selectedBsiProduct);
        }
      }
    });
  }, [selectedKey, selectedBsiProduct, hydrateBsiProductDraft]);

  useEffect(() => { load(); }, [load]);

  const selectPartner = (k) => {
    setSelectedKey(k);
    if (data?.partners?.[k]) {
      const p = structuredClone(data.partners[k]);
      setDraft(p);
      if (k === "bsi_prapen") {
        hydrateBsiProductDraft(p, selectedBsiProduct);
      }
    }
  };

  const selectBsiSubProduct = (prodCode) => {
    setSelectedBsiProduct(prodCode);
    if (data?.partners?.bsi_prapen) {
      hydrateBsiProductDraft(data.partners.bsi_prapen, prodCode);
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

  const setBsiLoanNum = (field, val) => {
    setBsiProductDraft((prev) => ({
      ...prev,
      loan: { ...(prev?.loan || {}), [field]: Number(val) },
    }));
  };

  const setBsiAgeYm = (part, val) => {
    const numVal = Number(val);
    setBsiProductDraft((prev) => {
      const nextYears = part === "years" ? numVal : Number(prev?._endAgeYears ?? 74);
      const nextMonths = part === "months" ? numVal : Number(prev?._endAgeMonths ?? 0);
      const clampedMonths = Math.max(0, Math.min(11, Number.isFinite(nextMonths) ? Math.trunc(nextMonths) : 0));
      const clampedYears = Math.max(55, Math.min(85, Number.isFinite(nextYears) ? Math.trunc(nextYears) : 74));
      return {
        ...prev,
        _endAgeYears: clampedYears,
        _endAgeMonths: clampedMonths,
        loan: {
          ...(prev?.loan || {}),
          maxMaturityAgeMonths: clampedYears * 12 + clampedMonths,
        },
      };
    });
  };

  const setBsiActiveNum = (field, val) => {
    setBsiProductDraft((prev) => ({
      ...prev,
      activePhase: { ...(prev?.activePhase || {}), [field]: Number(val) },
    }));
  };

  const setBsiRetiredNum = (field, val) => {
    setBsiProductDraft((prev) => ({
      ...prev,
      retiredPhase: { ...(prev?.retiredPhase || {}), [field]: Number(val) },
    }));
  };

  const setBsiFeeNum = (field, val) => {
    setBsiProductDraft((prev) => ({
      ...prev,
      fees: { ...(prev?.fees || {}), [field]: Number(val) },
    }));
  };

  const setBsiInsNum = (field, val) => {
    setBsiProductDraft((prev) => ({
      ...prev,
      insurance: { ...(prev?.insurance || {}), [field]: Number(val) },
    }));
  };

  const setBsiPricingTierNum = (tierKey, field, val) => {
    setBsiProductDraft((prev) => ({
      ...prev,
      pricingTiers: {
        ...(prev?.pricingTiers || {}),
        [tierKey]: {
          ...(prev?.pricingTiers?.[tierKey] || {}),
          [field]: Number(val),
        },
      },
    }));
  };

  const saveParams = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (selectedKey === "bsi_prapen" && bsiProductDraft) {
        const isPensiun = selectedBsiProduct === "PENSIUN";
        const payload = {
          expectedPolicyVersion: bsiProductDraft.policyVersion,
          loan: {
            minPlafondAbsolute: Number(bsiProductDraft.loan?.minPlafondAbsolute),
            maxPlafondAbsolute: Number(bsiProductDraft.loan?.maxPlafondAbsolute),
            maxTenorMonths: Number(bsiProductDraft.loan?.maxTenorMonths),
            maxMaturityAgeMonths:
              Number(bsiProductDraft._endAgeYears) * 12 + Number(bsiProductDraft._endAgeMonths ?? 0),
            ...(isPensiun
              ? {
                  minBankAgePensiunan: Number(bsiProductDraft.loan?.minBankAgePensiunan ?? 50),
                  minBankAgeJanda: Number(bsiProductDraft.loan?.minBankAgeJanda ?? 48),
                }
              : {}),
          },
          ...(isPensiun
            ? {
                retiredPhase: {
                  defaultBaseRateAnnual: Number(bsiProductDraft.retiredPhase?.defaultBaseRateAnnual ?? 10.5),
                  maxInstallmentRatioPercent: Number(bsiProductDraft.retiredPhase?.maxInstallmentRatioPercent ?? 90),
                  minInstallmentRatioPercent: Number(bsiProductDraft.retiredPhase?.minInstallmentRatioPercent ?? 70),
                  spouseFactorWithSpouse: Number(bsiProductDraft.retiredPhase?.spouseFactorWithSpouse ?? 0.98),
                  maxAttributionPremiumRatioPercent: Number(
                    bsiProductDraft.retiredPhase?.maxAttributionPremiumRatioPercent ?? 70
                  ),
                },
              }
            : {
                activePhase: {
                  maxMonthsToRetirement: Number(bsiProductDraft.activePhase?.maxMonthsToRetirement),
                  bupAgeDefault: Number(bsiProductDraft.activePhase?.bupAgeDefault ?? 58),
                  dbrActivePayroll: Number(bsiProductDraft.activePhase?.dbrActivePayroll ?? 70),
                  dbrActivePayrollColek: Number(bsiProductDraft.activePhase?.dbrActivePayrollColek ?? 80),
                  dbrActiveNonPayroll: Number(bsiProductDraft.activePhase?.dbrActiveNonPayroll ?? 50),
                },
                retiredPhase: {
                  maxInstallmentRatioPercent: Number(bsiProductDraft.retiredPhase?.maxInstallmentRatioPercent ?? 90),
                },
                pricingTiers: bsiProductDraft.pricingTiers,
              }),
          fees: {
            adminRatePercent: Number(bsiProductDraft.fees?.adminRatePercent ?? 1.0),
            materaiFee: Number(bsiProductDraft.fees?.materaiFee ?? 100000),
            taksasiMmqMarkupPercent: Number(bsiProductDraft.fees?.taksasiMmqMarkupPercent ?? 2.0),
            ...(isPensiun
              ? {
                  blokirAtribusiCount: Number(bsiProductDraft.fees?.blokirAtribusiCount ?? 2),
                }
              : {
                  blokirActiveCount: Number(bsiProductDraft.fees?.blokirActiveCount ?? 1),
                  blokirPensionCount: Number(bsiProductDraft.fees?.blokirPensionCount ?? 2),
                }),
          },
          insurance: {
            bufferDefaultMonths: Number(bsiProductDraft.insurance?.bufferDefaultMonths ?? 0),
            ...(isPensiun
              ? {
                  maxSumAssured: Number(bsiProductDraft.insurance?.maxSumAssured ?? 500000000),
                }
              : {}),
          },
        };

        const { data: res } = await api.put(`/calc/params/bsi_prapen/products/${selectedBsiProduct}`, {
          updates: payload,
          expectedPolicyVersion: bsiProductDraft.policyVersion,
          reason: reason || `Penyesuaian parameter BSI ${selectedBsiProduct}`,
        });
        toast.success(res.message);
        setReason("");
        load();
        return;
      }

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

  const resetBsiProduct = async () => {
    if (!window.confirm(`Reset parameter produk BSI ${selectedBsiProduct} ke nilai standar awal?`)) return;
    setBusy(true);
    try {
      await api.post(`/calc/params/bsi_prapen/products/${selectedBsiProduct}/reset`);
      toast.success(`Parameter BSI ${selectedBsiProduct} dikembalikan ke standar awal`);
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
            ? " Sebagai Super Admin (Owner), perubahan Anda langsung aktif pada mesin kalkulator seluruh cabang."
            : " Sebagai Admin Operasional, setiap perubahan akan dikirim sebagai usulan (Dual Control) ke Super Admin untuk disetujui."}
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

          {/* 2. BSI PRAPENSIUN & PENSIUN BERKAH (PER-PRODUCT SCOPED CONFIG) */}
          {selectedKey === "bsi_prapen" && bsiProductDraft && (
            <div className="space-y-5" data-testid="bsi-product-params-panel">
              {/* Selector Produk BSI */}
              <div className="rounded-xl border border-[#078D67]/25 bg-[#078D67]/[0.03] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wider text-[#078D67]">
                      Pilih Sub-Produk BSI (Konfigurasi Terisolasi per Produk)
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Setiap perubahan hanya berlaku untuk produk yang dipilih tanpa mencemari produk BSI lainnya.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 font-mono text-[11px] font-bold text-[#078D67] ring-1 ring-[#078D67]/30" data-testid="bsi-policy-version-badge">
                      Policy: {bsiProductDraft.policyVersion}
                    </span>
                    {user.role === "super_admin" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={resetBsiProduct}
                        data-testid={`reset-bsi-product-${selectedBsiProduct}`}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset {selectedBsiProduct}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-3">
                  {BSI_SUB_PRODUCTS.map((sp) => {
                    const activeTab = selectedBsiProduct === sp.code;
                    return (
                      <button
                        key={sp.code}
                        type="button"
                        onClick={() => selectBsiSubProduct(sp.code)}
                        data-testid={`bsi-param-subtab-${sp.code}`}
                        className={`rounded-xl border p-3 text-left transition ${
                          activeTab
                            ? "border-[#078D67] bg-[#078D67] text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-[#078D67]/40"
                        }`}
                      >
                        <p className="font-display text-xs font-bold">{sp.label}</p>
                        <p className={`mt-0.5 text-[11px] ${activeTab ? "text-emerald-100" : "text-slate-500"}`}>
                          {sp.subtitle}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-900/10 pt-2.5 text-[11px] text-slate-500">
                  <span>
                    Produk Aktif: <b className="text-slate-800">{bsiProductDraft.productName || bsiProductDraft.label}</b>
                  </span>
                  <span>
                    Pembaruan Terakhir:{" "}
                    <b className="text-slate-700">
                      {bsiProductDraft.updatedAt ? new Date(bsiProductDraft.updatedAt).toLocaleString("id-ID") : "-"}
                    </b>{" "}
                    oleh <b className="text-slate-700">{bsiProductDraft.updatedBy || "-"}</b>
                  </span>
                </div>
              </div>

              {/* A. Batas Plafon, Tenor & Usia Jatuh Tempo (Tahun + Bulan 0..11) */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#351080]">
                  1. Batas Pembiayaan, Tenor &amp; Usia Jatuh Tempo ({selectedBsiProduct})
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label>Plafond Minimal (Rp)</Label>
                    <Input
                      type="number"
                      step="1000000"
                      disabled={!canEdit}
                      value={bsiProductDraft.loan?.minPlafondAbsolute ?? 10000000}
                      onChange={(e) => setBsiLoanNum("minPlafondAbsolute", e.target.value)}
                      className="lp-num"
                      data-testid="bsi-min-plafond-input"
                    />
                  </div>
                  <div>
                    <Label>Plafond Maksimal (Rp)</Label>
                    <Input
                      type="number"
                      step="10000000"
                      disabled={!canEdit}
                      value={bsiProductDraft.loan?.maxPlafondAbsolute ?? 800000000}
                      onChange={(e) => setBsiLoanNum("maxPlafondAbsolute", e.target.value)}
                      className="lp-num"
                      data-testid="bsi-max-plafond-input"
                    />
                  </div>
                  <div>
                    <Label>Tenor Maksimal (Bulan)</Label>
                    <Input
                      type="number"
                      min="12"
                      max={selectedBsiProduct === "PENSIUN" ? "180" : "240"}
                      disabled={!canEdit}
                      value={bsiProductDraft.loan?.maxTenorMonths ?? 180}
                      onChange={(e) => setBsiLoanNum("maxTenorMonths", e.target.value)}
                      className="lp-num"
                      data-testid="bsi-max-tenor-input"
                    />
                  </div>
                  <div>
                    <Label>Usia Akhir Maksimum (Tahun)</Label>
                    <Input
                      type="number"
                      min="55"
                      max="85"
                      disabled={!canEdit}
                      value={bsiProductDraft._endAgeYears ?? 74}
                      onChange={(e) => setBsiAgeYm("years", e.target.value)}
                      className="lp-num"
                      data-testid="bsi-end-age-years-input"
                    />
                  </div>
                  <div>
                    <Label>Tambahan Bulan Usia Akhir (0–11 Bulan)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="11"
                      disabled={!canEdit}
                      value={bsiProductDraft._endAgeMonths ?? 0}
                      onChange={(e) => setBsiAgeYm("months", e.target.value)}
                      className="lp-num"
                      data-testid="bsi-end-age-months-input"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Total: <b>{bsiProductDraft.loan?.maxMaturityAgeMonths} bulan</b> ({bsiProductDraft._endAgeYears} thn{" "}
                      {bsiProductDraft._endAgeMonths} bln)
                    </p>
                  </div>
                  <div>
                    <Label>Default Buffer Masa Asuransi (Bulan)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="24"
                      disabled={!canEdit}
                      value={bsiProductDraft.insurance?.bufferDefaultMonths ?? 0}
                      onChange={(e) => setBsiInsNum("bufferDefaultMonths", e.target.value)}
                      className="lp-num"
                      data-testid="bsi-buffer-months-input"
                    />
                  </div>
                </div>
              </div>

              {/* B. Parameter Fase Aktif & Pasca Pensiun untuk PP3 / PP10 */}
              {selectedBsiProduct !== "PENSIUN" ? (
                <>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#351080]">
                      2. DBR Masa Aktif — Prapen &amp; DSR Fase Pasca Pensiun — Prapen ({selectedBsiProduct})
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <Label>DBR Masa Aktif — Prapen (Payroll %)</Label>
                        <Input
                          type="number"
                          step="0.5"
                          disabled={!canEdit}
                          value={bsiProductDraft.activePhase?.dbrActivePayroll ?? 70}
                          onChange={(e) => setBsiActiveNum("dbrActivePayroll", e.target.value)}
                          className="lp-num"
                          data-testid="bsi-dbr-payroll-input"
                        />
                      </div>
                      <div>
                        <Label>DBR Masa Aktif — Prapen (Comitted Payroll %)</Label>
                        <Input
                          type="number"
                          step="0.5"
                          disabled={!canEdit}
                          value={bsiProductDraft.activePhase?.dbrActivePayrollColek ?? 80}
                          onChange={(e) => setBsiActiveNum("dbrActivePayrollColek", e.target.value)}
                          className="lp-num"
                          data-testid="bsi-dbr-colek-input"
                        />
                      </div>
                      <div>
                        <Label>DBR Masa Aktif — Prapen (Non-Payroll %)</Label>
                        <Input
                          type="number"
                          step="0.5"
                          disabled={!canEdit}
                          value={bsiProductDraft.activePhase?.dbrActiveNonPayroll ?? 50}
                          onChange={(e) => setBsiActiveNum("dbrActiveNonPayroll", e.target.value)}
                          className="lp-num"
                          data-testid="bsi-dbr-nonpayroll-input"
                        />
                      </div>
                      <div>
                        <Label>DSR Fase Pasca Pensiun — Prapen (%)</Label>
                        <Input
                          type="number"
                          step="0.5"
                          disabled={!canEdit}
                          value={bsiProductDraft.retiredPhase?.maxInstallmentRatioPercent ?? 90}
                          onChange={(e) => setBsiRetiredNum("maxInstallmentRatioPercent", e.target.value)}
                          className="lp-num"
                          data-testid="bsi-dsr-pension-input"
                        />
                      </div>
                      <div>
                        <Label>Jendela Maks Masa Aktif ke Pensiun (Bln)</Label>
                        <Input
                          type="number"
                          disabled={!canEdit}
                          value={bsiProductDraft.activePhase?.maxMonthsToRetirement ?? (selectedBsiProduct === "PP3" ? 36 : 120)}
                          onChange={(e) => setBsiActiveNum("maxMonthsToRetirement", e.target.value)}
                          className="lp-num"
                          data-testid="bsi-max-active-window-input"
                        />
                      </div>
                      <div>
                        <Label>Default Usia BUP (Tahun)</Label>
                        <Input
                          type="number"
                          disabled={!canEdit}
                          value={bsiProductDraft.activePhase?.bupAgeDefault ?? 58}
                          onChange={(e) => setBsiActiveNum("bupAgeDefault", e.target.value)}
                          className="lp-num"
                          data-testid="bsi-bup-default-input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pricing Tiers & Biaya Prapen */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#351080]">
                      3. Tier Pricing Margin &amp; Komponen Biaya ({selectedBsiProduct})
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {selectedBsiProduct === "PP3" ? (
                        <>
                          <div>
                            <Label>Margin Aktif ≥ Rp200 Jt (% p.a.)</Label>
                            <Input
                              type="number"
                              step="0.05"
                              disabled={!canEdit}
                              value={bsiProductDraft.pricingTiers?.triNettAbove200?.rateActiveAnnual ?? 9.25}
                              onChange={(e) => setBsiPricingTierNum("triNettAbove200", "rateActiveAnnual", e.target.value)}
                              className="lp-num"
                            />
                          </div>
                          <div>
                            <Label>Margin Pensiun ≥ Rp200 Jt (% p.a.)</Label>
                            <Input
                              type="number"
                              step="0.05"
                              disabled={!canEdit}
                              value={bsiProductDraft.pricingTiers?.triNettAbove200?.ratePensionAnnual ?? 10.5}
                              onChange={(e) => setBsiPricingTierNum("triNettAbove200", "ratePensionAnnual", e.target.value)}
                              className="lp-num"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <Label>Margin Aktif ≥ Rp200 Jt (% p.a.)</Label>
                            <Input
                              type="number"
                              step="0.05"
                              disabled={!canEdit}
                              value={bsiProductDraft.pricingTiers?.dekadeNettAbove200?.rateActiveAnnual ?? 9.5}
                              onChange={(e) => setBsiPricingTierNum("dekadeNettAbove200", "rateActiveAnnual", e.target.value)}
                              className="lp-num"
                            />
                          </div>
                          <div>
                            <Label>Margin Pensiun ≥ Rp200 Jt (% p.a.)</Label>
                            <Input
                              type="number"
                              step="0.05"
                              disabled={!canEdit}
                              value={bsiProductDraft.pricingTiers?.dekadeNettAbove200?.ratePensionAnnual ?? 10.5}
                              onChange={(e) => setBsiPricingTierNum("dekadeNettAbove200", "ratePensionAnnual", e.target.value)}
                              className="lp-num"
                            />
                          </div>
                        </>
                      )}
                      <div>
                        <Label>Margin Aktif &lt; Rp200 Jt (% p.a.)</Label>
                        <Input
                          type="number"
                          step="0.05"
                          disabled={!canEdit}
                          value={bsiProductDraft.pricingTiers?.below200?.rateActiveAnnual ?? 10.5}
                          onChange={(e) => setBsiPricingTierNum("below200", "rateActiveAnnual", e.target.value)}
                          className="lp-num"
                        />
                      </div>
                      <div>
                        <Label>Margin Pensiun &lt; Rp200 Jt (% p.a.)</Label>
                        <Input
                          type="number"
                          step="0.05"
                          disabled={!canEdit}
                          value={bsiProductDraft.pricingTiers?.below200?.ratePensionAnnual ?? 11.5}
                          onChange={(e) => setBsiPricingTierNum("below200", "ratePensionAnnual", e.target.value)}
                          className="lp-num"
                        />
                      </div>
                      <div>
                        <Label>Biaya Administrasi (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          disabled={!canEdit}
                          value={bsiProductDraft.fees?.adminRatePercent ?? 1.0}
                          onChange={(e) => setBsiFeeNum("adminRatePercent", e.target.value)}
                          className="lp-num"
                        />
                      </div>
                      <div>
                        <Label>Biaya Materai (Rp)</Label>
                        <Input
                          type="number"
                          step="10000"
                          disabled={!canEdit}
                          value={bsiProductDraft.fees?.materaiFee ?? 100000}
                          onChange={(e) => setBsiFeeNum("materaiFee", e.target.value)}
                          className="lp-num"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* C. Parameter Khusus Pensiun Berkah (PENSIUN) */
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#351080]">
                    2. Parameter Khusus BSI Pensiun Berkah &amp; Simas Pensiun (PENSIUN)
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <Label>Pricing Dasar Pensiun (% p.a.)</Label>
                      <Input
                        type="number"
                        step="0.05"
                        disabled={!canEdit}
                        value={bsiProductDraft.retiredPhase?.defaultBaseRateAnnual ?? 10.5}
                        onChange={(e) => setBsiRetiredNum("defaultBaseRateAnnual", e.target.value)}
                        className="lp-num"
                        data-testid="bsi-pensiun-base-rate-input"
                      />
                    </div>
                    <div>
                      <Label>Rasio DBR/DSR Maksimum Pensiun (%)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        disabled={!canEdit}
                        value={bsiProductDraft.retiredPhase?.maxInstallmentRatioPercent ?? 90}
                        onChange={(e) => setBsiRetiredNum("maxInstallmentRatioPercent", e.target.value)}
                        className="lp-num"
                        data-testid="bsi-pensiun-max-ratio-input"
                      />
                    </div>
                    <div>
                      <Label>Rasio DBR/DSR Opsi Bawah Pensiun (%)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        disabled={!canEdit}
                        value={bsiProductDraft.retiredPhase?.minInstallmentRatioPercent ?? 70}
                        onChange={(e) => setBsiRetiredNum("minInstallmentRatioPercent", e.target.value)}
                        className="lp-num"
                      />
                    </div>
                    <div>
                      <Label>Faktor Kapasitas Ada Pasangan (0.5–1.0)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        disabled={!canEdit}
                        value={bsiProductDraft.retiredPhase?.spouseFactorWithSpouse ?? 0.98}
                        onChange={(e) => setBsiRetiredNum("spouseFactorWithSpouse", e.target.value)}
                        className="lp-num"
                      />
                    </div>
                    <div>
                      <Label>Usia Min Bank — Pensiun Sendiri (Thn)</Label>
                      <Input
                        type="number"
                        disabled={!canEdit}
                        value={bsiProductDraft.loan?.minBankAgePensiunan ?? 50}
                        onChange={(e) => setBsiLoanNum("minBankAgePensiunan", e.target.value)}
                        className="lp-num"
                      />
                    </div>
                    <div>
                      <Label>Usia Min Bank — Pensiun Janda (Thn)</Label>
                      <Input
                        type="number"
                        disabled={!canEdit}
                        value={bsiProductDraft.loan?.minBankAgeJanda ?? 48}
                        onChange={(e) => setBsiLoanNum("minBankAgeJanda", e.target.value)}
                        className="lp-num"
                      />
                    </div>
                    <div>
                      <Label>Batas Santunan Simas Pensiun (Rp)</Label>
                      <Input
                        type="number"
                        step="10000000"
                        disabled={!canEdit}
                        value={bsiProductDraft.insurance?.maxSumAssured ?? 500000000}
                        onChange={(e) => setBsiInsNum("maxSumAssured", e.target.value)}
                        className="lp-num"
                      />
                    </div>
                    <div>
                      <Label>Batas Premi Atribusi thd Plafon (%)</Label>
                      <Input
                        type="number"
                        step="1"
                        disabled={!canEdit}
                        value={bsiProductDraft.retiredPhase?.maxAttributionPremiumRatioPercent ?? 70}
                        onChange={(e) => setBsiRetiredNum("maxAttributionPremiumRatioPercent", e.target.value)}
                        className="lp-num"
                      />
                    </div>
                    <div>
                      <Label>Biaya Administrasi (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        disabled={!canEdit}
                        value={bsiProductDraft.fees?.adminRatePercent ?? 1.0}
                        onChange={(e) => setBsiFeeNum("adminRatePercent", e.target.value)}
                        className="lp-num"
                      />
                    </div>
                  </div>
                </div>
              )}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[#351080]">{prop.partner_name}</p>
                    {prop.product_key && (
                      <span className="rounded-md bg-[#078D67]/15 px-2 py-0.5 text-[11px] font-bold text-[#078D67]">
                        Produk: {prop.product_key}
                      </span>
                    )}
                    {prop.base_policy_version && (
                      <span className="font-mono text-[11px] text-slate-500">
                        ({prop.base_policy_version} → {prop.target_policy_version || "baru"})
                      </span>
                    )}
                  </div>
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
      <div className="space-y-1.5"><Label htmlFor="cp2">Kata sandi baru (minimal 12 karakter)</Label><Input id="cp2" type="password" required minLength={12} value={v.new_password} onChange={(e) => setV({ ...v, new_password: e.target.value })} data-testid="new-password-input" /></div>
      <Button type="submit" className="bg-[#351080] hover:bg-[#2a0c66]" data-testid="change-password-submit">Simpan</Button>
    </form>
  );
}

function Backup() {
  const { user } = useAuth();
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
      <p className="text-sm text-slate-500">Unduh salinan JSON seluruh leads, aktivitas, simulasi, parameter mitra, dan audit log. Pemulihan mengganti koleksi data dan dilakukan pengelola sistem saat maintenance.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => downloadFile("/backup", "backup.json")} data-testid="backup-download-button"><Download className="mr-2 h-4 w-4" />Unduh Backup</Button>
        <input ref={ref} type="file" accept=".json" className="hidden" onChange={(e) => restore(e.target.files[0])} data-testid="restore-file-input" />
        <Button variant="outline" disabled={user.capabilities?.web_restore === false} onClick={() => ref.current.click()} data-testid="restore-button"><Upload className="mr-2 h-4 w-4" />Pulihkan dari File</Button>
      </div>
    </section>
  );
}

function UserProfileCard({ user }) {
  return (
    <section className="lp-card space-y-4 p-6" data-testid="user-profile-card">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-[#351080]" />
          <h2 className="font-display font-bold text-slate-900">Profil &amp; Informasi Pengguna</h2>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          <CheckCircle2 className="h-3.5 w-3.5" /> Akun Terverifikasi
        </span>
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#351080] text-xl font-bold text-white shadow-sm">
          {user.name?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-[#351080]/10 px-2 py-0.5 text-xs font-bold text-[#351080]">
              {ROLE_LABEL[user.role] || user.role}
            </span>
            <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
              Cabang: {user.branch || "PUSAT"}
            </span>
            {user.role === "admin_branch" && (
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  user.bank_scope === "bsi_only" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                }`}
              >
                {user.bank_scope === "bsi_only" ? "Khusus BSI" : "Semua Mitra"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 pt-1 text-xs sm:grid-cols-2">
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
          <span className="font-medium text-slate-400">ID Pengguna</span>
          <p className="mt-0.5 font-mono font-bold text-slate-800">{user.id}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
          <span className="font-medium text-slate-400">Penempatan Wilayah</span>
          <p className="mt-0.5 font-semibold text-slate-800">{user.branch || "Kantor Pusat Operasional"}</p>
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
        <p className="leading-relaxed">
          Hak akses akun dibatasi sesuai standar tata kelola perbankan (RBAC). Untuk perubahan nama, email, atau mutasi cabang, silakan ajukan permohonan ke Admin Operasional / Super Admin.
        </p>
      </div>
    </section>
  );
}

function AppSystemInfoCard() {
  return (
    <section className="lp-card space-y-4 p-6" data-testid="app-info-card">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Smartphone className="h-5 w-5 text-[#078D67]" />
        <h2 className="font-display font-bold text-slate-900">Informasi SuperApps PWA</h2>
      </div>

      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <span className="font-medium text-slate-500">Versi SuperApps Enterprise</span>
          <span className="font-mono font-bold text-[#351080]">v2.6.2 (Production Ready)</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <span className="font-medium text-slate-500">Koneksi Layanan</span>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Online (Terhubung)
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <span className="font-medium text-slate-500">Keamanan Cache PWA</span>
          <span className="font-semibold text-slate-700">Shell Terenkripsi &amp; Terisolasi</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 space-y-1">
        <p className="font-bold text-slate-800">Pusat Dukungan Operasional &amp; Bantuan:</p>
        <p>Email: <span className="font-mono text-slate-700">operasional@layananpensiunan.id</span></p>
        <p>Hotline Helpdesk Cabang: Hari Kerja 08.00 – 17.00 WIB</p>
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
  const isCentral = user?.role === "super_admin" || user?.role === "admin_ops";

  return (
    <div>
      <PageHeader
        eyebrow={isCentral ? "Pengaturan Enterprise & Parameter Sistem" : "Pengaturan Akun & Profil"}
        title={isCentral ? "Pengaturan Sistem & Parameter Mitra" : "Pengaturan Akun"}
        desc={
          isCentral
            ? "Kelola parameter aturan mitra bank secara dinamis, usulan dual control, keamanan akun, dan pencadangan database."
            : "Kelola profil pribadi, keamanan kata sandi, dan preferensi aplikasi operasional Anda."
        }
      />
      {isCentral ? (
        <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
          <DynamicPartnerParams user={user} />
          <div className="space-y-6">
            <AccountLogout user={user} />
            <ChangePassword />
            {user.role === "super_admin" && <Backup />}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <UserProfileCard user={user} />
            <AccountLogout user={user} />
          </div>
          <div className="space-y-6">
            <ChangePassword />
            <AppSystemInfoCard />
          </div>
        </div>
      )}
    </div>
  );
}

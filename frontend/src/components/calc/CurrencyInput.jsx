import { Input } from "../ui/input";

export default function CurrencyInput({ value, onChange, ...rest }) {
  const display = value === "" || value == null ? "" : Number(value).toLocaleString("id-ID");
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Rp</span>
      <Input inputMode="numeric" className="h-11 pl-10 lp-num" value={display}
        onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); onChange(d === "" ? "" : Number(d)); }} {...rest} />
    </div>
  );
}


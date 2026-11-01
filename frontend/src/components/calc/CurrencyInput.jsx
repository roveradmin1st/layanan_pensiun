import { cn } from "../../lib/utils";

export default function CurrencyInput({
  value,
  onChange,
  placeholder = "0",
  className = "",
  id,
  required,
  disabled,
  ...rest
}) {
  const display = value === "" || value == null ? "" : Number(value).toLocaleString("id-ID");

  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 select-none text-xs font-semibold text-slate-400">
        Rp
      </span>
      <input
        id={id}
        required={required}
        disabled={disabled}
        inputMode="numeric"
        placeholder={placeholder}
        value={display}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, "");
          onChange(d === "" ? "" : Number(d));
        }}
        className={cn(
          "flex h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium text-slate-800 lp-num placeholder:text-slate-400 focus:border-[#351080] focus:outline-none focus:ring-1 focus:ring-[#351080] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          className
        )}
        {...rest}
      />
    </div>
  );
}


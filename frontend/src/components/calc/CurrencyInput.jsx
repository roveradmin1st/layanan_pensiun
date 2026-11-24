import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

function caretPositionForDigitCount(formatted, digitTarget) {
  if (!formatted || digitTarget <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (formatted[i] >= "0" && formatted[i] <= "9") {
      seen += 1;
      if (seen === digitTarget) return i + 1;
    }
  }
  return formatted.length;
}

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
  const inputRef = useRef(null);
  const pendingDigitsBeforeCaretRef = useRef(null);
  const [caretTick, setCaretTick] = useState(0);

  const display = value === "" || value == null ? "" : Number(value).toLocaleString("id-ID");

  useLayoutEffect(() => {
    if (pendingDigitsBeforeCaretRef.current === null) return;
    const targetDigits = pendingDigitsBeforeCaretRef.current;
    pendingDigitsBeforeCaretRef.current = null;
    const el = inputRef.current;
    if (!el || typeof document === "undefined" || document.activeElement !== el) return;
    const nextPos = caretPositionForDigitCount(display, targetDigits);
    try {
      el.setSelectionRange(nextPos, nextPos);
    } catch {
      /* ignore unsupported input selection */
    }
  }, [display, caretTick]);

  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 select-none text-xs font-semibold text-slate-400">
        Rp
      </span>
      <input
        ref={inputRef}
        id={id}
        required={required}
        disabled={disabled}
        inputMode="numeric"
        placeholder={placeholder}
        value={display}
        onChange={(e) => {
          const raw = e.target.value;
          const selStart = typeof e.target.selectionStart === "number" ? e.target.selectionStart : raw.length;
          const digitsBeforeCaret = raw.slice(0, selStart).replace(/\D/g, "").length;
          const d = raw.replace(/\D/g, "");
          const leadingZerosBeforeCaret =
            d.length > 1 && d.startsWith("0")
              ? Math.min(digitsBeforeCaret, d.length - d.replace(/^0+/, "").length)
              : 0;
          pendingDigitsBeforeCaretRef.current = Math.max(0, digitsBeforeCaret - leadingZerosBeforeCaret);
          setCaretTick((t) => t + 1);
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

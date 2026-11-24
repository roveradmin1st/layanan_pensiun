import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { rp } from "../../lib/format";
import { Empty } from "../common";

export default function FinancialTrendChart({ data, showGrossFee = true }) {
  if (!data?.length) return <Empty text="Belum ada data riwayat keuangan" />;
  return (
    <div className="h-[270px] sm:h-[300px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -10, right: 8, top: 16 }}>
          <CartesianGrid stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `Rp${Math.round(v / 1000000)}jt`}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(val) => rp(val)}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
          />
          <Bar dataKey="booking" name="Realisasi Booking" fill="#078D67" radius={[4, 4, 0, 0]} maxBarSize={30} />
          {showGrossFee && (
            <Bar dataKey="revenue" name="Gross Fee Perusahaan (4%)" fill="#5720B8" radius={[4, 4, 0, 0]} maxBarSize={30} />
          )}
          <Bar dataKey="insentif" name="Insentif Terbayar (PAID)" fill="#F28A19" radius={[4, 4, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

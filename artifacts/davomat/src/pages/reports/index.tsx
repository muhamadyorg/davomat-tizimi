import React, { useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3, Calendar, Building2 } from "lucide-react";
import { useListDepartments } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const COLORS = ["hsl(142 76% 36%)", "hsl(0 84% 60%)", "hsl(38 92% 50%)", "hsl(221 83% 53%)"];
const STATUS_UZ: Record<string, string> = {
  present: "Keldi", absent: "Kelmadi", late: "Kech keldi", on_leave: "Ta'tilda"
};

export default function Reports() {
  const { data: departments } = useListDepartments();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [dept, setDept] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [year, m] = month.split("-");
      const start = format(startOfMonth(new Date(Number(year), Number(m) - 1)), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date(Number(year), Number(m) - 1)), "yyyy-MM-dd");
      const p = new URLSearchParams({ startDate: start, endDate: end });
      if (dept) p.set("departmentId", dept);
      const res = await fetch(`${BASE}/api/attendance/range?${p}`, { credentials: "include" });
      const rangeData = await res.json();
      setData(rangeData);
    } finally {
      setLoading(false);
    }
  }, [month, dept]);

  React.useEffect(() => { load(); }, [load]);

  const statusCounts = React.useMemo(() => {
    if (!data?.records) return [];
    const counts: Record<string, number> = { present: 0, absent: 0, late: 0, on_leave: 0 };
    data.records.forEach((r: any) => {
      if (r.status in counts) counts[r.status]++;
    });
    return Object.entries(counts).map(([k, v]) => ({ name: STATUS_UZ[k] || k, value: v }));
  }, [data]);

  const totalEmployees = data?.employees?.length || 0;
  const totalPresent = statusCounts.find(s => s.name === STATUS_UZ.present)?.value || 0;
  const totalAbsent = statusCounts.find(s => s.name === STATUS_UZ.absent)?.value || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Hisobotlar</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Davomat tahlili va statistikasi</p>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl p-4 flex flex-wrap gap-3 items-end shadow-sm">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-muted-foreground uppercase">Oy</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm font-medium" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-muted-foreground uppercase">Bo'lim</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select value={dept} onChange={e => setDept(e.target.value)}
              className="pl-9 pr-8 py-2 bg-background border border-border rounded-lg text-sm font-medium appearance-none">
              <option value="">Barcha bo'limlar</option>
              {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Jami xodimlar", val: totalEmployees, color: "text-primary" },
          { label: "Kelganlar (jami)", val: totalPresent, color: "text-green-600 dark:text-green-400" },
          { label: "Kelmadi (jami)", val: totalAbsent, color: "text-destructive" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium mb-1">{s.label}</p>
            <p className={`text-3xl font-bold font-display ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="h-72 bg-card animate-pulse rounded-2xl border border-border/50" />
      ) : (
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-foreground mb-5 font-display">Holat bo'yicha taqsimot</h3>
          {statusCounts.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusCounts}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 13 }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {statusCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
              <BarChart3 className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">Bu oy uchun ma'lumot yo'q</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

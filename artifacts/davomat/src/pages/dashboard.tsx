import React from "react";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Users, CheckCircle2, XCircle, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatTime, getStatusColor } from "@/lib/utils";

const STATUS_UZ: Record<string, string> = {
  present: "Keldi", absent: "Kelmadi", late: "Kech keldi", on_leave: "Ta'tilda", early_leave: "Erta ketdi"
};

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-card rounded-2xl border border-border/50" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-80 bg-card rounded-2xl border border-border/50" />
          <div className="h-80 bg-card rounded-2xl border border-border/50" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const total = stats.totalEmployees || 1;
  const chartData = [
    { name: "Keldi",      value: stats.todayPresent,  color: "hsl(142 76% 36%)" },
    { name: "Kelmadi",    value: stats.todayAbsent,   color: "hsl(0 84% 60%)" },
    { name: "Kech keldi", value: stats.todayLate,     color: "hsl(38 92% 50%)" },
    { name: "Ta'tilda",   value: stats.todayOnLeave,  color: "hsl(221 83% 53%)" },
  ];

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display">Bosh sahifa</h1>
        <p className="text-muted-foreground mt-1 text-sm">Bugungi davomat statistikasi</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Bugun keldi" value={stats.todayPresent}
          subtitle={`${total} xodimdan`}
          icon={<CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />}
          badge={`${Math.round((stats.todayPresent / total) * 100)}%`} badgeGreen />
        <StatCard title="Kelmadi" value={stats.todayAbsent}
          icon={<XCircle className="w-5 h-5 text-destructive" />}
          badge="E'tibor bering" />
        <StatCard title="Kech keldi" value={stats.todayLate}
          icon={<Clock className="w-5 h-5 text-orange-500" />} />
        <StatCard title="Jami xodimlar" value={stats.totalEmployees}
          icon={<Users className="w-5 h-5 text-primary" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-foreground mb-5 font-display">Bugungi taqsimot</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 13 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}>
                  {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col">
          <h3 className="text-base font-bold text-foreground mb-4 font-display">So'nggi faoliyat</h3>
          <div className="flex-1 overflow-y-auto space-y-3">
            {stats.recentAttendance?.length > 0 ? (
              stats.recentAttendance.slice(0, 6).map(r => (
                <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {r.userFullName?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.userFullName}</p>
                    <p className="text-xs text-muted-foreground">{r.departmentName || "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getStatusColor(r.status)}`}>
                      {STATUS_UZ[r.status] || r.status}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono">{formatTime(r.checkIn)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-8">
                <Users className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">Bugun faoliyat yo'q</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ title, value, subtitle, icon, badge, badgeGreen }: any) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="p-2.5 bg-muted rounded-xl">{icon}</div>
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${badgeGreen ? "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-xs font-medium mb-0.5">{title}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-foreground font-display">{value}</span>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
    </div>
  );
}

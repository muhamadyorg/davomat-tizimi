import React, { useState } from "react";
import { useGetReportSummary } from "@workspace/api-client-react";
import { format, subDays } from "date-fns";
import { FileBarChart, Calendar as CalIcon, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function Reports() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: summary, isLoading } = useGetReportSummary({ startDate, endDate });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display">Analytics & Reports</h1>
          <p className="text-muted-foreground mt-1">Comprehensive attendance statistics.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-card border border-border/50 rounded-xl p-1 shadow-sm">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-sm font-medium focus:ring-0 w-36" />
            <span className="text-muted-foreground px-2">-</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-sm font-medium focus:ring-0 w-36" />
          </div>
          <button className="p-2.5 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-colors">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-card rounded-2xl" />)}
          </div>
          <div className="h-96 bg-card rounded-2xl" />
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <StatCard title="Total Employees" value={summary.totalEmployees} />
            <StatCard title="Overall Attendance" value={`${Math.round(summary.attendanceRate)}%`} highlight />
            <StatCard title="Total Absences" value={summary.absentCount} />
            <StatCard title="Avg Daily Hours" value={`${summary.avgWorkHours.toFixed(1)}h`} />
          </div>

          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm mt-6">
            <h3 className="text-lg font-bold text-foreground mb-6 font-display">Department Breakdown</h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.byDepartment} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="departmentName" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted)/0.5)'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  />
                  <Bar dataKey="attendanceRate" name="Attendance Rate %" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {summary.byDepartment.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(221, 83%, ${Math.max(40, 80 - index * 10)}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({ title, value, highlight }: { title: string, value: any, highlight?: boolean }) {
  return (
    <div className={`bg-card border ${highlight ? 'border-primary shadow-primary/10' : 'border-border/50'} rounded-2xl p-6 shadow-sm`}>
      <h4 className="text-muted-foreground text-sm font-medium mb-2">{title}</h4>
      <span className={`text-3xl font-bold font-display ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

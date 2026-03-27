import React from "react";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Users, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatTime, getStatusColor } from "@/lib/utils";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48 mb-6"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-muted rounded-2xl"></div>
          <div className="h-96 bg-muted rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const chartData = [
    { name: "Present", value: stats.todayPresent, color: "hsl(var(--success))" },
    { name: "Absent", value: stats.todayAbsent, color: "hsl(var(--destructive))" },
    { name: "Late", value: stats.todayLate, color: "hsl(var(--warning))" },
    { name: "On Leave", value: stats.todayOnLeave, color: "hsl(var(--primary))" },
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-1">Today's attendance statistics and insights.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="Present Today" 
          value={stats.todayPresent} 
          subtitle={`out of ${stats.totalEmployees} total`}
          icon={<CheckCircle2 className="w-6 h-6 text-success" />}
          trend={`${Math.round((stats.todayPresent / stats.totalEmployees) * 100 || 0)}%`}
        />
        <StatCard 
          title="Absent" 
          value={stats.todayAbsent} 
          icon={<XCircle className="w-6 h-6 text-destructive" />}
          trend="Needs attention"
          trendDown
        />
        <StatCard 
          title="Late Arrivals" 
          value={stats.todayLate} 
          icon={<Clock className="w-6 h-6 text-warning" />}
        />
        <StatCard 
          title="Pending Leaves" 
          value={stats.pendingLeaveRequests} 
          icon={<AlertTriangle className="w-6 h-6 text-primary" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-foreground mb-6 font-display">Today's Distribution</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} />
                <Tooltip 
                  cursor={{fill: 'hsl(var(--muted)/0.5)'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-foreground font-display">Recent Activity</h3>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {stats.recentAttendance.length > 0 ? (
              stats.recentAttendance.slice(0, 5).map(record => (
                <div key={record.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                    {record.userFullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{record.userFullName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{record.departmentName || 'No Dept'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getStatusColor(record.status)}`}>
                      {record.status.replace('_', ' ')}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {formatTime(record.checkIn)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Users className="w-12 h-12 mb-3 opacity-20" />
                <p>No activity today</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ title, value, subtitle, icon, trend, trendDown }: any) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-muted rounded-xl">
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${trendDown ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <h4 className="text-muted-foreground text-sm font-medium mb-1">{title}</h4>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground font-display">{value}</span>
          {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
        </div>
      </div>
    </div>
  );
}

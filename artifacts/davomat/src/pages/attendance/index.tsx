import React, { useState } from "react";
import { useListAttendance, useListDepartments } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { Search, Filter, Calendar as CalIcon, Download } from "lucide-react";
import { formatTime, getStatusColor } from "@/lib/utils";

export default function AttendanceList() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [departmentId, setDepartmentId] = useState<number | undefined>();
  
  const { data: records, isLoading } = useListAttendance({ date, departmentId });
  const { data: departments } = useListDepartments();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display">Attendance Records</h1>
          <p className="text-muted-foreground mt-1">View and manage daily attendance.</p>
        </div>
        <button className="px-4 py-2 bg-background border border-border rounded-xl shadow-sm text-foreground font-medium flex items-center gap-2 hover:bg-muted transition-colors">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-4 flex flex-col md:flex-row gap-4 items-end md:items-center">
        <div className="flex-1 w-full space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase ml-1">Date</label>
          <div className="relative">
            <CalIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
            />
          </div>
        </div>

        <div className="flex-1 w-full space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase ml-1">Department</label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={departmentId || ""}
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium appearance-none"
            >
              <option value="">All Departments</option>
              {departments?.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex-1 w-full md:max-w-xs space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase ml-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search employee..."
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border/50">
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Check In</th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Check Out</th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Hours</th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">Loading...</td>
                </tr>
              ) : !records?.length ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    No attendance records found for this date.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {record.userFullName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-foreground">{record.userFullName}</div>
                          <div className="text-xs text-muted-foreground">{record.departmentName || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getStatusColor(record.status)}`}>
                        {record.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm">{formatTime(record.checkIn)}</td>
                    <td className="px-6 py-4 font-mono text-sm">{formatTime(record.checkOut)}</td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-sm">{record.workHours > 0 ? `${record.workHours.toFixed(1)}h` : '-'}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground truncate max-w-[150px]">
                      {record.note || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { useListDepartments } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { Calendar, ChevronDown, Save, Check, AlertCircle, Clock, Users, Building2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type AttendanceStatus = "present" | "absent" | "late" | "on_leave" | "early_leave";

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  departmentId: number | null;
  departmentName: string | null;
  shiftName: string | null;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  position: string | null;
  role: string;
}

interface AttendanceRecord {
  id: number;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  note: string | null;
  lateMinutes: number;
  workHours: number;
}

interface DailyEntry {
  employee: Employee;
  attendance: AttendanceRecord | null;
}

interface RowState {
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
  note: string;
  saving: boolean;
  saved: boolean;
  error: string;
  dirty: boolean;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "present",     label: "Keldi",         color: "text-green-600 bg-green-50 border-green-200" },
  { value: "absent",      label: "Kelmadi",       color: "text-red-600 bg-red-50 border-red-200" },
  { value: "late",        label: "Kech keldi",    color: "text-orange-600 bg-orange-50 border-orange-200" },
  { value: "on_leave",    label: "Ta'tilda",      color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "early_leave", label: "Erta ketdi",    color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
];

function getStatusStyle(status: AttendanceStatus) {
  return STATUS_OPTIONS.find(s => s.value === status)?.color || "text-muted-foreground bg-muted border-border";
}

export default function AttendanceMarkingPage() {
  const { user } = useAuth();
  const { data: departments } = useListDepartments();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [loading, setLoading] = useState(false);
  const [saveAllLoading, setSaveAllLoading] = useState(false);

  const fetchDaily = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (deptFilter) params.set("departmentId", deptFilter);
      const res = await fetch(`${BASE_URL}/api/attendance/daily?${params}`, { credentials: "include" });
      const data: DailyEntry[] = await res.json();
      setEntries(data);

      const initialRows: Record<number, RowState> = {};
      data.forEach(({ employee, attendance }) => {
        const ci = attendance?.checkIn ? format(new Date(attendance.checkIn), "HH:mm") : "";
        const co = attendance?.checkOut ? format(new Date(attendance.checkOut), "HH:mm") : "";
        initialRows[employee.id] = {
          status: attendance?.status || "absent",
          checkIn: ci,
          checkOut: co,
          note: attendance?.note || "",
          saving: false,
          saved: false,
          error: "",
          dirty: false,
        };
      });
      setRows(initialRows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [date, deptFilter]);

  useEffect(() => { fetchDaily(); }, [fetchDaily]);

  const updateRow = (employeeId: number, field: keyof RowState, value: any) => {
    setRows(prev => ({
      ...prev,
      [employeeId]: { ...prev[employeeId], [field]: value, dirty: true, saved: false, error: "" }
    }));
  };

  const saveRow = async (employeeId: number) => {
    const row = rows[employeeId];
    setRows(prev => ({ ...prev, [employeeId]: { ...prev[employeeId], saving: true, error: "" } }));
    try {
      const res = await fetch(`${BASE_URL}/api/attendance/mark`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: employeeId,
          date,
          status: row.status,
          checkIn: row.checkIn || null,
          checkOut: row.checkOut || null,
          note: row.note || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Xatolik");
      }
      setRows(prev => ({ ...prev, [employeeId]: { ...prev[employeeId], saving: false, saved: true, dirty: false } }));
    } catch (e: any) {
      setRows(prev => ({ ...prev, [employeeId]: { ...prev[employeeId], saving: false, error: e.message } }));
    }
  };

  const saveAll = async () => {
    setSaveAllLoading(true);
    const dirtyIds = Object.entries(rows)
      .filter(([, row]) => row.dirty || !entries.find(e => e.employee.id === Number(entries[0]?.employee.id) )?.attendance)
      .map(([id]) => Number(id));

    const allIds = entries.map(e => e.employee.id);
    for (const id of allIds) {
      await saveRow(id);
    }
    setSaveAllLoading(false);
  };

  // Group by department
  const grouped: Record<string, DailyEntry[]> = {};
  entries.forEach(entry => {
    const deptName = entry.employee.departmentName || "Bo'limsiz";
    if (!grouped[deptName]) grouped[deptName] = [];
    grouped[deptName].push(entry);
  });

  const markedCount = Object.values(rows).filter(r => r.saved || r.status !== "absent").length;
  const totalCount = entries.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display">Davomat belgilash</h1>
          <p className="text-muted-foreground mt-1">
            Xodimlarning kunlik davomatini jadval ko'rinishida belgilang.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDaily}
            className="p-2.5 bg-muted text-muted-foreground rounded-xl hover:text-foreground transition-colors"
            title="Yangilash"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={saveAll}
            disabled={saveAllLoading}
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-semibold shadow-lg shadow-primary/25 flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saveAllLoading ? "Saqlanmoqda..." : "Hammasini saqlash"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 shadow-sm">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Sana</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Bo'lim</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm font-medium appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Barcha bo'limlar</option>
              {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-end gap-4 pb-0.5">
          <div className="text-center px-4 py-2 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl">
            <div className="text-lg font-bold text-green-700 dark:text-green-400">
              {Object.values(rows).filter(r => r.status === "present" || r.status === "late").length}
            </div>
            <div className="text-xs text-green-600 dark:text-green-500 font-medium">Keldi</div>
          </div>
          <div className="text-center px-4 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
            <div className="text-lg font-bold text-red-700 dark:text-red-400">
              {Object.values(rows).filter(r => r.status === "absent").length}
            </div>
            <div className="text-xs text-red-600 dark:text-red-500 font-medium">Kelmadi</div>
          </div>
          <div className="text-center px-4 py-2 bg-muted border border-border/50 rounded-xl">
            <div className="text-lg font-bold text-foreground">{totalCount}</div>
            <div className="text-xs text-muted-foreground font-medium">Jami</div>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-card animate-pulse rounded-2xl border border-border/50" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([deptName, deptEntries]) => (
            <div key={deptName} className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
              {/* Department Header */}
              <div className="flex items-center gap-3 px-6 py-4 bg-muted/40 border-b border-border/50">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-foreground">{deptName}</h3>
                <span className="ml-auto text-xs font-semibold text-muted-foreground bg-background px-2 py-1 rounded-md border border-border/50">
                  {deptEntries.length} xodim
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-[220px]">
                        Xodim
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-[160px]">
                        Holat
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-[120px]">
                        Kelish
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-[120px]">
                        Ketish
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Izoh
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider w-[90px]">
                        Amal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {deptEntries.map(({ employee }) => {
                      const row = rows[employee.id];
                      if (!row) return null;
                      const statusOpt = STATUS_OPTIONS.find(s => s.value === row.status);

                      return (
                        <tr
                          key={employee.id}
                          className={cn(
                            "transition-colors",
                            row.saved ? "bg-green-50/50 dark:bg-green-500/5" : "hover:bg-muted/20"
                          )}
                        >
                          {/* Employee */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                {employee.firstName[0]}{employee.lastName[0]}
                              </div>
                              <div>
                                <div className="font-semibold text-sm text-foreground">
                                  {employee.firstName} {employee.lastName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {employee.shiftStartTime
                                    ? `${employee.shiftStartTime.slice(0, 5)} – ${employee.shiftEndTime?.slice(0, 5)}`
                                    : employee.position || "—"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3">
                            <select
                              value={row.status}
                              onChange={e => updateRow(employee.id, "status", e.target.value as AttendanceStatus)}
                              className={cn(
                                "w-full px-2 py-1.5 rounded-lg border text-xs font-semibold appearance-none cursor-pointer focus:ring-2 focus:ring-primary/20 focus:outline-none",
                                getStatusStyle(row.status)
                              )}
                            >
                              {STATUS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </td>

                          {/* Check-in */}
                          <td className="px-3 py-3">
                            <input
                              type="time"
                              value={row.checkIn}
                              onChange={e => updateRow(employee.id, "checkIn", e.target.value)}
                              disabled={row.status === "absent" || row.status === "on_leave"}
                              className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                          </td>

                          {/* Check-out */}
                          <td className="px-3 py-3">
                            <input
                              type="time"
                              value={row.checkOut}
                              onChange={e => updateRow(employee.id, "checkOut", e.target.value)}
                              disabled={row.status === "absent" || row.status === "on_leave"}
                              className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                          </td>

                          {/* Note */}
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={row.note}
                              onChange={e => updateRow(employee.id, "note", e.target.value)}
                              placeholder="Izoh..."
                              className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                          </td>

                          {/* Action */}
                          <td className="px-3 py-3 text-center">
                            {row.error && (
                              <div className="text-xs text-destructive mb-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {row.error}
                              </div>
                            )}
                            {row.saved ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold">
                                <Check className="w-4 h-4" /> Saqlandi
                              </span>
                            ) : (
                              <button
                                onClick={() => saveRow(employee.id)}
                                disabled={row.saving}
                                className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 whitespace-nowrap"
                              >
                                {row.saving ? "..." : "Saqlash"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {entries.length === 0 && (
            <div className="bg-card border border-border/50 rounded-2xl p-16 text-center shadow-sm">
              <Users className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Xodimlar topilmadi</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Avval xodimlarni tizimga qo'shing</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { useListDepartments } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { Calendar, Save, Check, Lock, AlertCircle, Building2, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Status = "present" | "absent" | "late" | "on_leave";

const STATUSES: { value: Status; label: string; emoji: string; color: string; bg: string }[] = [
  { value: "present",  label: "Keldi",       emoji: "✓", color: "text-green-700 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30" },
  { value: "absent",   label: "Kelmadi",     emoji: "✗", color: "text-red-700 dark:text-red-400",    bg: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30" },
  { value: "on_leave", label: "Ta'tilda",    emoji: "T", color: "text-blue-700 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30" },
  { value: "late",     label: "Kech keldi",  emoji: "K", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30" },
];

interface EmpRow {
  id: number;
  firstName: string;
  lastName: string;
  departmentName: string | null;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  role: string;
}

interface AttRec {
  id: number;
  status: Status;
  checkIn: string | null;
  checkOut: string | null;
  note: string | null;
  editCount: number;
}

interface RowState {
  status: Status;
  checkIn: string;
  checkOut: string;
  note: string;
  saving: boolean;
  saved: boolean;
  locked: boolean;
  error: string;
  attId: number | null;
}

export default function AttendanceMark() {
  const { user } = useAuth();
  const { data: departments } = useListDepartments();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dept, setDept] = useState("");
  const [entries, setEntries] = useState<{ employee: EmpRow; attendance: AttRec | null }[]>([]);
  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [savingNote, setSavingNote] = useState<Record<number, boolean>>({});

  const isSuperAdmin = user?.role === "superadmin";
  const maxEdits = isSuperAdmin ? 2 : 1;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ date });
      if (dept) p.set("departmentId", dept);
      const res = await fetch(`${BASE}/api/attendance/daily?${p}`, { credentials: "include" });
      if (!res.ok) return;
      const data: { employee: EmpRow; attendance: AttRec | null }[] = await res.json();
      if (!Array.isArray(data)) return;
      setEntries(data);

      const init: Record<number, RowState> = {};
      data.forEach(({ employee, attendance: att }) => {
        const ci = att?.checkIn ? format(new Date(att.checkIn), "HH:mm") : "";
        const co = att?.checkOut ? format(new Date(att.checkOut), "HH:mm") : "";
        const edits = att?.editCount ?? 0;
        const locked = att ? edits >= maxEdits : false;
        init[employee.id] = {
          status: att?.status ?? "absent",
          checkIn: ci, checkOut: co,
          note: att?.note ?? "",
          saving: false, saved: !!att, locked,
          error: "", attId: att?.id ?? null,
        };
      });
      setRows(init);
    } finally {
      setLoading(false);
    }
  }, [date, dept, maxEdits]);

  useEffect(() => { load(); }, [load]);

  const updateRow = (id: number, field: keyof RowState, val: any) => {
    setRows(p => ({ ...p, [id]: { ...p[id], [field]: val, error: "" } }));
  };

  const saveOne = async (empId: number): Promise<boolean> => {
    const row = rows[empId];
    if (row.locked) return true;
    setRows(p => ({ ...p, [empId]: { ...p[empId], saving: true, error: "" } }));
    try {
      const res = await fetch(`${BASE}/api/attendance/mark`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: empId, date,
          status: row.status,
          checkIn: row.checkIn || null,
          checkOut: row.checkOut || null,
          note: row.note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRows(p => ({ ...p, [empId]: { ...p[empId], saving: false, error: data.message || "Xatolik" } }));
        return false;
      }
      const locked = (data.editCount ?? 0) >= maxEdits;
      setRows(p => ({ ...p, [empId]: { ...p[empId], saving: false, saved: true, locked, attId: data.id } }));
      return true;
    } catch {
      setRows(p => ({ ...p, [empId]: { ...p[empId], saving: false, error: "Xatolik" } }));
      return false;
    }
  };

  const saveNoteOnly = async (empId: number) => {
    const row = rows[empId];
    if (!row.attId) return;
    setSavingNote(p => ({ ...p, [empId]: true }));
    try {
      await fetch(`${BASE}/api/attendance/note/${row.attId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: row.note || null }),
      });
    } finally {
      setSavingNote(p => ({ ...p, [empId]: false }));
    }
  };

  const saveAll = async () => {
    setSavingAll(true);
    setConfirmOpen(false);
    const ids = entries.map(e => e.employee.id);
    for (const id of ids) {
      if (!rows[id]?.locked) await saveOne(id);
    }
    setSavingAll(false);
  };

  // Group by department
  const grouped: Record<string, typeof entries> = {};
  entries.forEach(e => {
    const d = e.employee.departmentName || "Bo'limsiz";
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(e);
  });

  const presentCount = Object.values(rows).filter(r => r.status === "present" || r.status === "late").length;
  const absentCount = Object.values(rows).filter(r => r.status === "absent").length;
  const leaveCount = Object.values(rows).filter(r => r.status === "on_leave").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Davomat belgilash</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Sana bo'yicha xodimlar davomatini belgilang</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 bg-muted text-muted-foreground rounded-xl hover:text-foreground transition-colors" title="Yangilash">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={savingAll || entries.every(e => rows[e.employee.id]?.locked)}
            className="px-5 py-2 bg-primary text-white rounded-xl font-semibold shadow-md shadow-primary/20 flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-40 text-sm"
          >
            <Save className="w-4 h-4" />
            {savingAll ? "Saqlanmoqda..." : "Hammasini saqlash"}
          </button>
        </div>
      </div>

      {/* Filters + Stats */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 flex flex-wrap gap-3 items-end shadow-sm">
        <div className="flex-1 min-w-[140px] space-y-1">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Sana</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
        </div>
        <div className="flex-1 min-w-[160px] space-y-1">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Bo'lim</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select value={dept} onChange={e => setDept(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm font-medium appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="">Barcha bo'limlar</option>
              {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 items-center pb-0.5">
          {[
            { label: "Keldi", val: presentCount, color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20" },
            { label: "Kelmadi", val: absentCount, color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20" },
            { label: "Ta'til", val: leaveCount, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20" },
            { label: "Jami", val: entries.length, color: "text-foreground bg-muted border-border/50" },
          ].map(s => (
            <div key={s.label} className={cn("text-center px-3 py-1.5 rounded-lg border", s.color)}>
              <div className="text-base font-bold">{s.val}</div>
              <div className="text-[10px] font-semibold">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-card animate-pulse rounded-xl border border-border/50" />)}
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([deptName, list]) => (
            <div key={deptName} className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 bg-muted/40 border-b border-border/50">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="font-bold text-sm text-foreground">{deptName}</span>
                <span className="ml-auto text-xs text-muted-foreground">{list.length} xodim</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border/30 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-2.5 text-left w-[200px]">Xodim</th>
                      <th className="px-3 py-2.5 text-left w-[180px]">Holat</th>
                      <th className="px-3 py-2.5 text-left w-[110px]">Kelish</th>
                      <th className="px-3 py-2.5 text-left w-[110px]">Ketish</th>
                      <th className="px-3 py-2.5 text-left">Izoh</th>
                      <th className="px-3 py-2.5 text-center w-[100px]">Amal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {list.map(({ employee }) => {
                      const row = rows[employee.id];
                      if (!row) return null;
                      const st = STATUSES.find(s => s.value === row.status)!;
                      const noTime = row.status === "absent" || row.status === "on_leave";

                      return (
                        <tr key={employee.id} className={cn(
                          "transition-colors",
                          row.locked ? "bg-muted/30" : "hover:bg-muted/10"
                        )}>
                          {/* Name */}
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                {employee.firstName[0]}{employee.lastName[0]}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-foreground leading-tight">
                                  {employee.firstName} {employee.lastName}
                                </div>
                                {employee.shiftStartTime && (
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    {employee.shiftStartTime.slice(0, 5)}–{employee.shiftEndTime?.slice(0, 5)}
                                  </div>
                                )}
                              </div>
                              {row.locked && <Lock className="w-3 h-3 text-muted-foreground ml-1 shrink-0" />}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-3 py-2.5">
                            {row.locked ? (
                              <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold", st.bg, st.color)}>
                                {st.emoji} {st.label}
                              </span>
                            ) : (
                              <div className="flex gap-1">
                                {STATUSES.map(s => (
                                  <button
                                    key={s.value}
                                    onClick={() => updateRow(employee.id, "status", s.value)}
                                    title={s.label}
                                    className={cn(
                                      "w-7 h-7 rounded-lg border text-xs font-bold transition-all",
                                      row.status === s.value
                                        ? cn(s.bg, s.color, "shadow-sm scale-105")
                                        : "bg-muted/50 text-muted-foreground border-border/50 hover:border-primary/30"
                                    )}
                                  >
                                    {s.emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Check-in */}
                          <td className="px-3 py-2.5">
                            <input type="time" value={row.checkIn} onChange={e => updateRow(employee.id, "checkIn", e.target.value)}
                              disabled={row.locked || noTime}
                              className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary/20 disabled:opacity-30 disabled:cursor-not-allowed" />
                          </td>

                          {/* Check-out */}
                          <td className="px-3 py-2.5">
                            <input type="time" value={row.checkOut} onChange={e => updateRow(employee.id, "checkOut", e.target.value)}
                              disabled={row.locked || noTime}
                              className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary/20 disabled:opacity-30 disabled:cursor-not-allowed" />
                          </td>

                          {/* Note - always editable */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              <input type="text" value={row.note} onChange={e => updateRow(employee.id, "note", e.target.value)}
                                placeholder="Izoh..."
                                className="flex-1 px-2 py-1.5 bg-background border border-border rounded-lg text-xs focus:ring-2 focus:ring-primary/20 min-w-0" />
                              {row.locked && row.attId && (
                                <button onClick={() => saveNoteOnly(employee.id)} disabled={savingNote[employee.id]}
                                  className="shrink-0 px-2 py-1.5 bg-muted text-muted-foreground hover:text-foreground rounded-lg text-xs transition-colors disabled:opacity-50">
                                  {savingNote[employee.id] ? "..." : "✓"}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Action */}
                          <td className="px-3 py-2.5 text-center">
                            {row.error && <div className="text-[10px] text-destructive mb-1 flex items-center gap-1 justify-center"><AlertCircle className="w-3 h-3" />{row.error}</div>}
                            {row.locked ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                                <Lock className="w-3 h-3" /> Qulflangan
                              </span>
                            ) : row.saved ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-green-600 font-semibold">
                                <Check className="w-3.5 h-3.5" /> Saqlandi
                              </span>
                            ) : (
                              <button onClick={() => saveOne(employee.id)} disabled={row.saving}
                                className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
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
            <div className="bg-card border border-border/50 rounded-2xl p-16 text-center">
              <p className="text-muted-foreground">Xodimlar topilmadi. Avval xodim qo'shing.</p>
            </div>
          )}
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Tasdiqlaysizmi?</h3>
                <p className="text-xs text-muted-foreground">Bu amalni ortga qaytarib bo'lmaydi</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Agar hozir "Saqlash"ni bossangiz, barcha xodimlar davomati belgilanadi va
              {isSuperAdmin ? " faqat 1 marta yana tahrir qilish mumkin bo'ladi." : " qaytarib o'zgartirib bo'lmaydi."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2.5 bg-muted text-foreground rounded-xl font-semibold text-sm hover:bg-muted/80 transition-colors">
                Ortga
              </button>
              <button onClick={saveAll}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors">
                Ha, saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

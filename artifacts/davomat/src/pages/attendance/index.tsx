import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useListDepartments } from "@workspace/api-client-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, eachDayOfInterval } from "date-fns";
import { Building2, Users, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Tab = "kunlik" | "haftalik" | "oyunchi" | "oylik";
type StatusType = "present" | "absent" | "late" | "on_leave" | "early_leave" | "partial";

const STATUS_CELL: Record<StatusType, { emoji: string; label: string; cls: string }> = {
  present:     { emoji: "✓", label: "Keldi",      cls: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300" },
  late:        { emoji: "K", label: "Kech keldi", cls: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300" },
  absent:      { emoji: "✗", label: "Kelmadi",    cls: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300" },
  on_leave:    { emoji: "T", label: "Ta'tilda",   cls: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300" },
  early_leave: { emoji: "E", label: "Erta ketdi", cls: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300" },
  partial:     { emoji: "S", label: "Smena",      cls: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300" },
};

interface Emp { id: number; firstName: string; lastName: string; departmentId: number | null; departmentName: string | null; role: string; }
interface AttRec { id: number; userId: number; date: string; status: StatusType; checkIn: string | null; checkOut: string | null; workHours: number; note: string | null; partialValue?: number | null; }

function getDateRange(tab: Tab, anchor: Date): { start: Date; end: Date; label: string } {
  switch (tab) {
    case "kunlik":
      return { start: anchor, end: anchor, label: format(anchor, "d MMMM yyyy") };
    case "haftalik": {
      const s = startOfWeek(anchor, { weekStartsOn: 1 });
      const e = endOfWeek(anchor, { weekStartsOn: 1 });
      return { start: s, end: e, label: `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}` };
    }
    case "oyunchi": {
      const s = subDays(anchor, 14);
      return { start: s, end: anchor, label: `${format(s, "d MMM")} – ${format(anchor, "d MMM yyyy")}` };
    }
    case "oylik": {
      const s = startOfMonth(anchor);
      const e = endOfMonth(anchor);
      return { start: s, end: e, label: format(anchor, "MMMM yyyy") };
    }
  }
}

// Tooltip rendered into document.body via portal to escape scroll container clipping
function DayCell({ rec }: { rec?: AttRec }) {
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);

  if (!rec) {
    return (
      <td className="p-0.5">
        <div className="w-8 h-8 rounded-md bg-muted/30 text-muted-foreground/30 flex items-center justify-center text-xs select-none">–</div>
      </td>
    );
  }

  const s = STATUS_CELL[rec.status] ?? STATUS_CELL["absent"];
  const timeIn  = rec.checkIn  ? format(new Date(rec.checkIn),  "HH:mm") : "";
  const timeOut = rec.checkOut ? format(new Date(rec.checkOut), "HH:mm") : "";
  const displayEmoji = rec.status === "partial" && rec.partialValue ? String(rec.partialValue) : s.emoji;

  return (
    <td className="p-0.5">
      <button
        onMouseEnter={(e) => setTipPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTipPos(null)}
        onMouseMove={(e) => setTipPos({ x: e.clientX, y: e.clientY })}
        className={cn("w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-bold transition-colors", s.cls)}
      >
        {displayEmoji}
      </button>

      {tipPos && createPortal(
        <div
          style={{
            position: "fixed",
            left: tipPos.x + 14,
            top: tipPos.y - 10,
            transform: "translateY(-100%)",
            zIndex: 99999,
            pointerEvents: "none",
          }}
          className="bg-card border border-border rounded-xl shadow-2xl p-3 min-w-[170px] text-left"
        >
          <div className={cn("text-xs font-bold mb-1.5", s.cls.split(" ").filter(c => c.startsWith("text-")).join(" "))}>
            {s.label}{rec.status === "partial" && rec.partialValue ? ` (${rec.partialValue} kun)` : ""}
          </div>
          {timeIn  && <div className="text-[11px] text-muted-foreground font-mono">Keldi: {timeIn}</div>}
          {timeOut && <div className="text-[11px] text-muted-foreground font-mono">Ketdi: {timeOut}</div>}
          {rec.workHours > 0 && <div className="text-[11px] text-muted-foreground mt-0.5">{rec.workHours.toFixed(1)} soat ishladi</div>}
          {rec.note && (
            <div className="mt-1.5 pt-1.5 border-t border-border/50 text-[11px] text-foreground italic">"{rec.note}"</div>
          )}
        </div>,
        document.body
      )}
    </td>
  );
}

export default function AttendanceHistory() {
  const { data: departments } = useListDepartments();
  const [tab, setTab] = useState<Tab>("kunlik");
  const [anchor, setAnchor] = useState(new Date());
  const [dept, setDept] = useState("");
  const [empFilter, setEmpFilter] = useState("");
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [records, setRecords] = useState<AttRec[]>([]);
  const [loading, setLoading] = useState(false);

  const { start, end, label } = getDateRange(tab, anchor);
  const days = eachDayOfInterval({ start, end });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ startDate: format(start, "yyyy-MM-dd"), endDate: format(end, "yyyy-MM-dd") });
      if (dept) p.set("departmentId", dept);
      const res = await fetch(`${BASE}/api/attendance/range?${p}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setEmployees(Array.isArray(data.employees) ? data.employees : []);
      setRecords(Array.isArray(data.records) ? data.records : []);
    } finally {
      setLoading(false);
    }
  }, [tab, anchor, dept]);

  useEffect(() => { load(); }, [load]);

  const recMap = new Map<string, AttRec>();
  records.forEach(r => recMap.set(`${r.userId}_${r.date}`, r));

  const filteredEmps = employees.filter(e => {
    if (!empFilter) return true;
    return `${e.firstName} ${e.lastName}`.toLowerCase().includes(empFilter.toLowerCase());
  });

  const grouped: Record<string, Emp[]> = {};
  filteredEmps.forEach(e => {
    const d = e.departmentName || "Bo'limsiz";
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(e);
  });

  const navPrev = () => {
    const d = new Date(anchor);
    if (tab === "kunlik") d.setDate(d.getDate() - 1);
    else if (tab === "haftalik") d.setDate(d.getDate() - 7);
    else if (tab === "oyunchi") d.setDate(d.getDate() - 15);
    else d.setMonth(d.getMonth() - 1);
    setAnchor(d);
  };
  const navNext = () => {
    const d = new Date(anchor);
    if (tab === "kunlik") d.setDate(d.getDate() + 1);
    else if (tab === "haftalik") d.setDate(d.getDate() + 7);
    else if (tab === "oyunchi") d.setDate(d.getDate() + 15);
    else d.setMonth(d.getMonth() + 1);
    setAnchor(d);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "kunlik", label: "Kunlik" },
    { id: "haftalik", label: "Haftalik" },
    { id: "oyunchi", label: "15 kunlik" },
    { id: "oylik", label: "Oylik" },
  ];

  const WEEK_DAYS = ["Yak", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Davomat tarixi</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Xodimlarning davomat statistikasi</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
              tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 flex flex-wrap gap-3 items-center shadow-sm">
        {/* Period navigation */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button onClick={navPrev} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-foreground px-2 min-w-[190px] text-center">{label}</span>
          <button onClick={navNext} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-w-[150px]">
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select value={dept} onChange={e => setDept(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm font-medium appearance-none">
              <option value="">Barcha bo'limlar</option>
              {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 min-w-[150px]">
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" value={empFilter} onChange={e => setEmpFilter(e.target.value)}
              placeholder="Xodim qidiring..."
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm" />
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-1.5 flex-wrap">
          {(["present", "partial", "absent", "on_leave"] as StatusType[]).map(k => {
            const v = STATUS_CELL[k];
            return (
              <span key={k} className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md", v.cls)}>
                {v.emoji} {v.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-card animate-pulse rounded-xl border border-border/50" />)}
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([deptName, emps]) => (
            <div key={deptName} className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 bg-muted/40 border-b border-border/50">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="font-bold text-sm">{deptName}</span>
                <span className="ml-auto text-xs text-muted-foreground">{emps.length} xodim</span>
              </div>

              {/* Scroll wrapper — only horizontal, so tooltips (rendered to body) won't be clipped */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: Math.max(400, 200 + days.length * 36 + 120) }}>
                  <thead>
                    <tr className="border-b border-border/30">
                      {/* Sticky name column */}
                      <th className="px-4 py-2 text-left text-xs font-bold text-muted-foreground bg-card sticky left-0 z-10 min-w-[160px]">
                        Xodim
                      </th>
                      {days.map(d => (
                        <th key={d.toISOString()} className="px-0.5 py-2 text-center min-w-[34px]">
                          <div className={cn("text-[10px] font-bold leading-none",
                            [0, 6].includes(d.getDay()) ? "text-muted-foreground/40" : "text-muted-foreground"
                          )}>
                            {format(d, "dd")}
                          </div>
                          <div className="text-[9px] text-muted-foreground/50 mt-0.5">{WEEK_DAYS[d.getDay()]}</div>
                        </th>
                      ))}
                      <th className="px-3 py-2 text-center text-xs font-bold text-muted-foreground min-w-[60px]">Jami kun</th>
                      <th className="px-3 py-2 text-center text-xs font-bold text-muted-foreground min-w-[54px]">Soat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {emps.map(emp => {
                      const empRecs = days.map(d => recMap.get(`${emp.id}_${format(d, "yyyy-MM-dd")}`));
                      const totalDays = empRecs.reduce((acc, r) => {
                        if (!r) return acc;
                        if (r.status === "present" || r.status === "late") return acc + 1;
                        if (r.status === "partial" && r.partialValue) return acc + r.partialValue;
                        return acc;
                      }, 0);
                      const totalHours = empRecs.reduce((acc, r) => acc + (r?.workHours ?? 0), 0);
                      return (
                        <tr key={emp.id} className="hover:bg-muted/10 transition-colors">
                          {/* Sticky name */}
                          <td className="px-4 py-2 bg-card sticky left-0 z-10">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                                {emp.firstName[0]}{emp.lastName[0]}
                              </div>
                              <span className="text-sm font-medium text-foreground whitespace-nowrap">
                                {emp.firstName} {emp.lastName}
                              </span>
                            </div>
                          </td>
                          {/* Day cells */}
                          {days.map((d, i) => (
                            <DayCell key={d.toISOString()} rec={empRecs[i]} />
                          ))}
                          {/* Totals */}
                          <td className="px-3 py-2 text-center">
                            <span className="text-sm font-bold text-foreground">{Number.isInteger(totalDays) ? totalDays : totalDays.toFixed(1)}</span>
                            <span className="text-xs text-muted-foreground">/{days.length}</span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="text-xs font-medium text-muted-foreground">{totalHours.toFixed(0)}h</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {filteredEmps.length === 0 && (
            <div className="bg-card border border-border/50 rounded-2xl p-12 text-center">
              <Info className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground">Bu davr uchun ma'lumot topilmadi</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

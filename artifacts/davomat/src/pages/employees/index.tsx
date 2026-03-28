import React, { useState } from "react";
import { useListDepartments } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Phone, Building2, MoreVertical, X, Edit2, Trash2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: "superadmin" | "admin" | "employee";
  departmentId: number | null;
  departmentName: string | null;
  isActive: boolean;
}

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "employee", label: "Xodim" },
];

function genUsername(first: string, last: string) {
  return `${first.toLowerCase().replace(/\s/g, "")}_${last.toLowerCase().replace(/\s/g, "")}_${Math.floor(Math.random() * 9000 + 1000)}`;
}
function genPassword() {
  return Math.random().toString(36).slice(2, 10);
}

export default function Employees() {
  const { user } = useAuth();
  const { data: departments } = useListDepartments();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === "superadmin";

  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);

  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", role: "employee", departmentId: "" });
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", phone: "", departmentId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadEmps = React.useCallback(async () => {
    setLoading(true);
    try {
      const p = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`${BASE}/api/users${p}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      setEmployees(data.filter((e: Employee) => e.role !== "superadmin"));
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => { loadEmps(); }, [loadEmps]);

  const openAdd = () => {
    setForm({ firstName: "", lastName: "", phone: "", role: "employee", departmentId: "" });
    setFormError("");
    setAddOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setDetailEmp(emp);
    setEditForm({ firstName: emp.firstName, lastName: emp.lastName, phone: emp.phone || "", departmentId: emp.departmentId?.toString() || "" });
    setEditOpen(true);
    setMenuOpen(null);
  };

  const handleAdd = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError("Ism va familiya majburiy");
      return;
    }
    setSaving(true); setFormError("");
    try {
      const isAdmin = form.role === "admin";
      const body: any = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || null,
        role: form.role,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        username: genUsername(form.firstName, form.lastName),
        password: isAdmin ? genPassword() : genPassword(),
      };
      const res = await fetch(`${BASE}/api/users`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.message || "Xatolik");
        return;
      }
      setAddOpen(false);
      loadEmps();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      setFormError("Ism va familiya majburiy");
      return;
    }
    setSaving(true); setFormError("");
    try {
      const res = await fetch(`${BASE}/api/users/${detailEmp!.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          phone: editForm.phone.trim() || null,
          departmentId: editForm.departmentId ? Number(editForm.departmentId) : null,
        }),
      });
      if (!res.ok) { const err = await res.json(); setFormError(err.message || "Xatolik"); return; }
      setEditOpen(false);
      loadEmps();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`${emp.firstName} ${emp.lastName} ni o'chirishni tasdiqlaysizmi?`)) return;
    await fetch(`${BASE}/api/users/${emp.id}`, { method: "DELETE", credentials: "include" });
    setMenuOpen(null);
    loadEmps();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Xodimlar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Xodimlar ro'yxatini boshqaring</p>
        </div>
        <button onClick={openAdd}
          className="px-4 py-2 bg-primary text-white rounded-xl font-semibold shadow-md shadow-primary/20 flex items-center gap-2 hover:bg-primary/90 transition-all text-sm">
          <Plus className="w-4 h-4" /> Xodim qo'shish
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Ism bo'yicha qidiring..."
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/50 rounded-xl text-sm shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-36 bg-card animate-pulse rounded-2xl border border-border/50" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {employees.map(emp => (
            <div key={emp.id} className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative group">
              {/* 3-dot menu */}
              <div className="absolute top-4 right-4">
                <button onClick={() => setMenuOpen(menuOpen === emp.id ? null : emp.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
                  <MoreVertical className="w-4 h-4" />
                </button>
                {menuOpen === emp.id && (
                  <div className="absolute right-0 top-8 z-20 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[140px]">
                    <button onClick={() => { setDetailEmp(emp); setMenuOpen(null); }}
                      className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2">
                      <Search className="w-3.5 h-3.5" /> Ko'rish
                    </button>
                    {isSuperAdmin && (
                      <button onClick={() => openEdit(emp)}
                        className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2">
                        <Edit2 className="w-3.5 h-3.5" /> Tahrirlash
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button onClick={() => handleDelete(emp)}
                        className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5" /> O'chirish
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Card */}
              <button className="w-full text-left" onClick={() => { setDetailEmp(emp); setMenuOpen(null); }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    "w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg shrink-0",
                    emp.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm leading-tight truncate">{emp.firstName} {emp.lastName}</p>
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md mt-0.5 inline-block",
                      emp.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {emp.role === "admin" ? "Admin" : "Xodim"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {emp.departmentName && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="w-3.5 h-3.5" /> {emp.departmentName}
                    </div>
                  )}
                  {emp.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3.5 h-3.5" /> {emp.phone}
                    </div>
                  )}
                </div>
              </button>
            </div>
          ))}

          {employees.length === 0 && (
            <div className="col-span-full bg-card border border-border/50 rounded-2xl p-12 text-center">
              <p className="text-muted-foreground">Xodimlar topilmadi</p>
            </div>
          )}
        </div>
      )}

      {/* Employee detail modal */}
      {detailEmp && !editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-foreground font-display">Xodim ma'lumotlari</h3>
              <button onClick={() => setDetailEmp(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col items-center mb-5">
              <div className={cn("w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl mb-3",
                detailEmp.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {detailEmp.firstName[0]}{detailEmp.lastName[0]}
              </div>
              <h4 className="text-xl font-bold text-foreground">{detailEmp.firstName} {detailEmp.lastName}</h4>
              <span className={cn("text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1",
                detailEmp.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {detailEmp.role === "admin" ? "Admin" : "Xodim"}
              </span>
            </div>
            <div className="space-y-3 mb-5">
              <InfoRow label="Ism" value={detailEmp.firstName} />
              <InfoRow label="Familiya" value={detailEmp.lastName} />
              <InfoRow label="Telefon" value={detailEmp.phone || "—"} />
              <InfoRow label="Bo'lim" value={detailEmp.departmentName || "—"} />
            </div>
            {isSuperAdmin && (
              <button onClick={() => { openEdit(detailEmp); setDetailEmp(null); }}
                className="w-full py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                <Edit2 className="w-4 h-4" /> Tahrirlash
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add modal */}
      {addOpen && (
        <Modal title="Yangi xodim qo'shish" onClose={() => setAddOpen(false)}>
          <div className="space-y-4">
            {formError && <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ism *" value={form.firstName} onChange={v => setForm(p => ({ ...p, firstName: v }))} placeholder="Alisher" />
              <FormField label="Familiya *" value={form.lastName} onChange={v => setForm(p => ({ ...p, lastName: v }))} placeholder="Navoiy" />
            </div>
            <FormField label="Telefon" value={form.phone} onChange={v => setForm(p => ({ ...p, phone: v }))} placeholder="+998901234567" />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Rol</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Bo'lim</label>
              <select value={form.departmentId} onChange={e => setForm(p => ({ ...p, departmentId: e.target.value }))}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20">
                <option value="">— Bo'limsiz —</option>
                {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2 border-t border-border/50">
              <button onClick={() => setAddOpen(false)} className="flex-1 py-2.5 bg-muted text-foreground rounded-xl font-semibold text-sm">Bekor</button>
              <button onClick={handleAdd} disabled={saving} className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50">
                {saving ? "Qo'shilmoqda..." : "Qo'shish"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editOpen && detailEmp && (
        <Modal title="Xodimni tahrirlash" onClose={() => setEditOpen(false)}>
          <div className="space-y-4">
            {formError && <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ism *" value={editForm.firstName} onChange={v => setEditForm(p => ({ ...p, firstName: v }))} />
              <FormField label="Familiya *" value={editForm.lastName} onChange={v => setEditForm(p => ({ ...p, lastName: v }))} />
            </div>
            <FormField label="Telefon" value={editForm.phone} onChange={v => setEditForm(p => ({ ...p, phone: v }))} placeholder="+998901234567" />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Bo'lim</label>
              <select value={editForm.departmentId} onChange={e => setEditForm(p => ({ ...p, departmentId: e.target.value }))}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20">
                <option value="">— Bo'limsiz —</option>
                {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2 border-t border-border/50">
              <button onClick={() => setEditOpen(false)} className="flex-1 py-2.5 bg-muted text-foreground rounded-xl font-semibold text-sm">Bekor</button>
              <button onClick={handleEdit} disabled={saving} className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50">
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Close menu on outside click */}
      {menuOpen !== null && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" />
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg text-foreground font-display">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

import React, { useState, useCallback } from "react";
import { useListDepartments } from "@workspace/api-client-react";
import { Plus, Search, Phone, Building2, MoreVertical, X, Edit2, Trash2, AlertCircle, KeyRound, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Employee {
  id: number;
  username: string;
  plainPassword?: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: "superadmin" | "admin" | "employee";
  departmentId: number | null;
  departmentName: string | null;
  isActive: boolean;
}

function genUsername(first: string, last: string) {
  const f = first.toLowerCase().replace(/\s/g, "").replace(/[^a-z0-9]/g, "");
  const l = last.toLowerCase().replace(/\s/g, "").replace(/[^a-z0-9]/g, "");
  return `${f}_${l}_${Math.floor(Math.random() * 9000 + 1000)}`;
}
function genPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.floor(Math.random() * 100);
}

function roleName(role: string) {
  if (role === "superadmin") return "Super Admin";
  if (role === "admin") return "Admin";
  return "Xodim";
}

export default function Employees() {
  const { user } = useAuth();
  const { data: departments } = useListDepartments();
  const isSuperAdmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin";

  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", role: "employee", departmentId: "" });
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", phone: "", departmentId: "", role: "employee", username: "" });
  const [pwForm, setPwForm] = useState({ newPassword: "", showNew: false });
  const [showDetailPw, setShowDetailPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadEmps = useCallback(async () => {
    setLoading(true);
    try {
      const p = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`${BASE}/api/users${p}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      // Hide superadmin from list (admin can't see superadmin)
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
    setEditForm({
      firstName: emp.firstName,
      lastName: emp.lastName,
      phone: emp.phone || "",
      departmentId: emp.departmentId?.toString() || "",
      role: emp.role,
      username: emp.username || "",
    });
    setFormError("");
    setEditOpen(true);
    setMenuOpen(null);
  };

  const openPw = (emp: Employee) => {
    setDetailEmp(emp);
    setPwForm({ newPassword: "", showNew: false });
    setFormError("");
    setPwOpen(true);
    setMenuOpen(null);
  };

  const handleAdd = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { setFormError("Ism va familiya majburiy"); return; }
    setSaving(true); setFormError("");
    try {
      const body: any = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || null,
        role: form.role,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        username: genUsername(form.firstName, form.lastName),
        password: genPassword(),
      };
      const res = await fetch(`${BASE}/api/users`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); setFormError(e.message || "Xatolik"); return; }
      setAddOpen(false);
      loadEmps();
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) { setFormError("Ism va familiya majburiy"); return; }
    setSaving(true); setFormError("");
    try {
      const body: any = {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim() || null,
        departmentId: editForm.departmentId ? Number(editForm.departmentId) : null,
      };
      // Superadmin can change role and username
      if (isSuperAdmin) {
        body.role = editForm.role;
        if (editForm.username.trim()) body.username = editForm.username.trim();
      }
      const res = await fetch(`${BASE}/api/users/${detailEmp!.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); setFormError(e.message || "Xatolik"); return; }
      setEditOpen(false);
      loadEmps();
    } finally { setSaving(false); }
  };

  const handlePwChange = async () => {
    if (!pwForm.newPassword.trim()) { setFormError("Yangi parol kiriting"); return; }
    if (pwForm.newPassword.length < 4) { setFormError("Parol kamida 4 ta belgi bo'lishi kerak"); return; }
    setSaving(true); setFormError("");
    try {
      const res = await fetch(`${BASE}/api/users/${detailEmp!.id}/password`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: pwForm.newPassword }),
      });
      if (!res.ok) { const e = await res.json(); setFormError(e.message || "Xatolik"); return; }
      setPwOpen(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`${emp.firstName} ${emp.lastName} ni o'chirishni tasdiqlaysizmi?`)) return;
    await fetch(`${BASE}/api/users/${emp.id}`, { method: "DELETE", credentials: "include" });
    setMenuOpen(null);
    loadEmps();
  };

  // Which roles can the current user add?
  const addableRoles = isSuperAdmin
    ? [{ value: "admin", label: "Admin" }, { value: "employee", label: "Xodim" }]
    : [{ value: "employee", label: "Xodim" }];

  // Can current user edit someone's credentials?
  const canEditCreds = (emp: Employee) => isSuperAdmin || (emp.id === user?.id);

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
              <div className="absolute top-4 right-4 z-10">
                <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === emp.id ? null : emp.id); }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
                  <MoreVertical className="w-4 h-4" />
                </button>
                {menuOpen === emp.id && (
                  <div className="absolute right-0 top-8 z-20 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[160px]">
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
                    {canEditCreds(emp) && (
                      <button onClick={() => openPw(emp)}
                        className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5" /> Login/Parol
                      </button>
                    )}
                    {(isSuperAdmin || isAdmin) && emp.id !== user?.id && (
                      <button onClick={() => handleDelete(emp)}
                        className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5" /> O'chirish
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Card body */}
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
                      {roleName(emp.role)}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {emp.departmentName && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="w-3.5 h-3.5 shrink-0" /> {emp.departmentName}
                    </div>
                  )}
                  {emp.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 shrink-0" /> {emp.phone}
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

      {/* ===== DETAIL MODAL ===== */}
      {detailEmp && !editOpen && !pwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-foreground font-display">Xodim ma'lumotlari</h3>
              <button onClick={() => { setDetailEmp(null); setShowDetailPw(false); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
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
                {roleName(detailEmp.role)}
              </span>
            </div>
            <div className="space-y-3 mb-5">
              <InfoRow label="Ism" value={detailEmp.firstName} />
              <InfoRow label="Familiya" value={detailEmp.lastName} />
              <InfoRow label="Telefon" value={detailEmp.phone || "—"} />
              <InfoRow label="Bo'lim" value={detailEmp.departmentName || "—"} />
              {/* Show username to superadmin or self */}
              {(isSuperAdmin || detailEmp.id === user?.id) && (
                <InfoRow label="Login" value={detailEmp.username} mono />
              )}
              {/* Show password only to superadmin */}
              {isSuperAdmin && (
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-sm text-muted-foreground w-28 shrink-0">Parol</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-foreground">
                      {detailEmp.plainPassword
                        ? (showDetailPw ? detailEmp.plainPassword : "••••••••")
                        : <span className="text-muted-foreground italic text-xs">mavjud emas</span>}
                    </span>
                    {detailEmp.plainPassword && (
                      <button onClick={() => setShowDetailPw(v => !v)}
                        className="text-muted-foreground hover:text-foreground transition-colors">
                        {showDetailPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {isSuperAdmin && (
                <button onClick={() => { openEdit(detailEmp); setDetailEmp(null); setShowDetailPw(false); }}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                  <Edit2 className="w-4 h-4" /> Tahrirlash
                </button>
              )}
              {canEditCreds(detailEmp) && (
                <button onClick={() => { openPw(detailEmp); setDetailEmp(null); setShowDetailPw(false); }}
                  className="flex-1 py-2.5 bg-muted text-foreground rounded-xl font-semibold text-sm hover:bg-muted/80 transition-colors flex items-center justify-center gap-2">
                  <KeyRound className="w-4 h-4" /> Parol
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== ADD MODAL ===== */}
      {addOpen && (
        <Modal title="Yangi xodim qo'shish" onClose={() => setAddOpen(false)}>
          <div className="space-y-4">
            {formError && <ErrBox msg={formError} />}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ism *" value={form.firstName} onChange={v => setForm(p => ({ ...p, firstName: v }))} placeholder="Alisher" />
              <FormField label="Familiya *" value={form.lastName} onChange={v => setForm(p => ({ ...p, lastName: v }))} placeholder="Navoiy" />
            </div>
            <FormField label="Telefon" value={form.phone} onChange={v => setForm(p => ({ ...p, phone: v }))} placeholder="+998901234567" />
            {isSuperAdmin && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Rol</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20">
                  {addableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            )}
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

      {/* ===== EDIT MODAL (superadmin only) ===== */}
      {editOpen && detailEmp && (
        <Modal title="Xodimni tahrirlash" onClose={() => setEditOpen(false)}>
          <div className="space-y-4">
            {formError && <ErrBox msg={formError} />}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ism *" value={editForm.firstName} onChange={v => setEditForm(p => ({ ...p, firstName: v }))} />
              <FormField label="Familiya *" value={editForm.lastName} onChange={v => setEditForm(p => ({ ...p, lastName: v }))} />
            </div>
            <FormField label="Telefon" value={editForm.phone} onChange={v => setEditForm(p => ({ ...p, phone: v }))} placeholder="+998901234567" />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Rol</label>
              <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20">
                <option value="admin">Admin</option>
                <option value="employee">Xodim</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Bo'lim</label>
              <select value={editForm.departmentId} onChange={e => setEditForm(p => ({ ...p, departmentId: e.target.value }))}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20">
                <option value="">— Bo'limsiz —</option>
                {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Login (username)</label>
              <input type="text" value={editForm.username} onChange={e => setEditForm(p => ({ ...p, username: e.target.value }))}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary/20" />
              <p className="text-[10px] text-muted-foreground">Bo'sh qoldirsangiz o'zgarmaydi</p>
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

      {/* ===== PASSWORD MODAL ===== */}
      {pwOpen && detailEmp && (
        <Modal title="Login/Parol o'zgartirish" onClose={() => setPwOpen(false)}>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-xl">
              <p className="text-xs text-muted-foreground mb-0.5">Xodim</p>
              <p className="font-semibold text-foreground">{detailEmp.firstName} {detailEmp.lastName}</p>
              <p className="text-xs font-mono text-muted-foreground mt-1">Login: {detailEmp.username}</p>
            </div>
            {formError && <ErrBox msg={formError} />}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Yangi parol</label>
              <div className="relative">
                <input
                  type={pwForm.showNew ? "text" : "password"}
                  value={pwForm.newPassword}
                  onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Kamida 4 ta belgi"
                  className="w-full px-3 pr-10 py-2.5 bg-background border border-border rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setPwForm(p => ({ ...p, showNew: !p.showNew }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {pwForm.showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-border/50">
              <button onClick={() => setPwOpen(false)} className="flex-1 py-2.5 bg-muted text-foreground rounded-xl font-semibold text-sm">Bekor</button>
              <button onClick={handlePwChange} disabled={saving} className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50">
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Close menu on outside click */}
      {menuOpen !== null && <div className="fixed inset-0 z-[5]" onClick={() => setMenuOpen(null)} />}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={cn("text-sm font-medium text-foreground", mono && "font-mono")}>{value}</span>
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

function ErrBox({ msg }: { msg: string }) {
  return (
    <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex gap-2">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{msg}
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

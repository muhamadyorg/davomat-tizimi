import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, ClipboardList, CalendarDays, Users, Building2,
  LogOut, Menu, X, Sun, Moon, KeyRound, Eye, EyeOff, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface NavItem { label: string; href: string; icon: React.ElementType; roles: string[]; }

const NAV_ITEMS: NavItem[] = [
  { label: "Bosh sahifa",       href: "/",               icon: LayoutDashboard, roles: ["superadmin", "admin"] },
  { label: "Davomat belgilash", href: "/attendance/mark", icon: ClipboardList,   roles: ["superadmin", "admin"] },
  { label: "Davomat tarixi",    href: "/attendance",     icon: CalendarDays,    roles: ["superadmin", "admin"] },
  { label: "Xodimlar",          href: "/employees",      icon: Users,           roles: ["superadmin", "admin"] },
  { label: "Bo'limlar",         href: "/departments",    icon: Building2,       roles: ["superadmin"] },
];

function roleName(role: string) {
  if (role === "superadmin") return "Super Admin";
  if (role === "admin") return "Admin";
  return "Xodim";
}

// Modal for changing own credentials
function MyAccountModal({ userId, username, onClose }: { userId: number; username: string; onClose: () => void }) {
  const [newUsername, setNewUsername] = useState(username);
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSave = async () => {
    setError(""); setSuccess("");
    if (!newUsername.trim()) { setError("Login bo'sh bo'lishi mumkin emas"); return; }
    setSaving(true);
    try {
      // Update username
      if (newUsername.trim() !== username) {
        const res = await fetch(`${BASE}/api/users/${userId}`, {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: newUsername.trim() }),
        });
        if (!res.ok) { const e = await res.json(); setError(e.message || "Login o'zgartirishda xatolik"); return; }
      }
      // Update password if provided
      if (newPassword.trim()) {
        if (newPassword.length < 4) { setError("Parol kamida 4 ta belgi bo'lishi kerak"); return; }
        const res2 = await fetch(`${BASE}/api/users/${userId}/password`, {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: newPassword.trim() }),
        });
        if (!res2.ok) { const e = await res2.json(); setError(e.message || "Parol o'zgartirishda xatolik"); return; }
      }
      setSuccess("Muvaffaqiyatli saqlandi!");
      setNewPassword("");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg text-foreground font-display">Mening akkauntim</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm rounded-lg">{success}</div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Login (username)</label>
            <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Yangi parol</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Bo'sh qoldirsangiz o'zgarmaydi"
                className="w-full px-3 pr-10 py-2.5 bg-background border border-border rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary/20"
              />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">Parolni o'zgartirmoqchi bo'lsangiz kiriting</p>
          </div>
          <div className="flex gap-3 pt-2 border-t border-border/50">
            <button onClick={onClose} className="flex-1 py-2.5 bg-muted text-foreground rounded-xl font-semibold text-sm">Yopish</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50">
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const queryClient = useQueryClient();
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    queryClient.clear();
    window.location.href = "/login";
  };

  if (!user) return null;

  const filteredNav = NAV_ITEMS.filter(item => item.roles.includes(user.role));

  const SidebarContent = () => (
    <>
      <div className="p-6 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 text-white font-bold text-lg">
            D
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-foreground block leading-none">Davomat</span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Tizimi</span>
          </div>
        </div>
        <button onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNav.map(item => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 text-sm",
                isActive
                  ? "bg-primary text-white shadow-md shadow-primary/30"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
              onClick={() => setIsMobileOpen(false)}>
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/50">
        {/* User info — clickable to open account modal */}
        <button
          onClick={() => setAccountOpen(true)}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors mb-2 text-left group"
          title="Login/Parol o'zgartirish"
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
            {user.firstName[0]}{user.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{user.firstName} {user.lastName}</p>
            <p className="text-xs text-muted-foreground">{roleName(user.role)}</p>
          </div>
          <KeyRound className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
        </button>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors">
          <LogOut className="w-4 h-4" /> Chiqish
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border/50 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold">D</div>
          <span className="font-bold text-foreground">Davomat</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAccountOpen(true)} className="p-2 rounded-lg bg-muted text-muted-foreground" title="Akkaunt">
            <KeyRound className="w-4 h-4" />
          </button>
          <button onClick={toggleTheme} className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2 rounded-lg bg-muted text-foreground">
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {isMobileOpen && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileOpen(false)} />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border/50 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 md:static shadow-xl md:shadow-none",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Account modal */}
      {accountOpen && (
        <MyAccountModal
          userId={user.id}
          username={user.username || ""}
          onClose={() => setAccountOpen(false)}
        />
      )}
    </div>
  );
}

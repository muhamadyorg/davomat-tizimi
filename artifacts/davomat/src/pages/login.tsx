import React, { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, User } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  const loginMutation = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await loginMutation.mutateAsync({ data: { username, password } });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Login yoki parol noto'g'ri");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/30 rounded-full blur-3xl" />
      
      <div className="w-full max-w-4xl bg-card rounded-3xl shadow-2xl border border-border/50 overflow-hidden flex flex-col md:flex-row relative z-10">
        {/* Left side - Branding */}
        <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-primary to-primary/80 p-12 flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white rounded-xl text-primary flex items-center justify-center font-bold text-2xl mb-6 shadow-lg">
              D
            </div>
            <h1 className="text-4xl font-bold mb-4 font-display">Davomat Tizimi</h1>
            <p className="text-primary-foreground/80 text-lg">
              Xodimlar davomatini qulay va aniq boshqaring.
            </p>
          </div>
          <div className="relative z-10">
            <p className="text-sm text-primary-foreground/60">© {new Date().getFullYear()} Davomat Tizimi</p>
          </div>
        </div>

        {/* Right side - Form */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 flex flex-col justify-center">
          <div className="mb-8 md:hidden">
            <div className="w-12 h-12 bg-primary rounded-xl text-white flex items-center justify-center font-bold text-2xl mb-4 shadow-lg">
              D
            </div>
            <h1 className="text-3xl font-bold font-display text-foreground">Davomat Tizimi</h1>
          </div>

          <h2 className="hidden md:block text-3xl font-bold font-display text-foreground mb-2">Xush kelibsiz</h2>
          <p className="text-muted-foreground mb-8">Tizimga kirish uchun ma'lumotlaringizni kiriting.</p>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Foydalanuvchi nomi</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text" value={username} onChange={e => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground"
                  placeholder="admin"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Parol</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit" disabled={loginMutation.isPending}
              className="w-full py-3.5 px-4 bg-primary text-white font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
            >
              {loginMutation.isPending ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Kirilmoqda...</>
              ) : "Kirish"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

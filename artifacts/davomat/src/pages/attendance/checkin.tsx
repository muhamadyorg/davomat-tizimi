import React, { useState, useEffect } from "react";
import { useGetTodayAttendance, useCheckIn, useCheckOut } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, Clock, Calendar as CalendarIcon, CheckCircle } from "lucide-react";
import { formatTime } from "@/lib/utils";

export default function CheckInOut() {
  const queryClient = useQueryClient();
  const { data: today, isLoading } = useGetTodayAttendance();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();

  const [note, setNote] = useState("");
  const [timeStr, setTimeStr] = useState(
    new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );
  const [checkInError, setCheckInError] = useState("");
  const [checkOutError, setCheckOutError] = useState("");
  const [checkInSuccess, setCheckInSuccess] = useState("");
  const [checkOutSuccess, setCheckOutSuccess] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCheckIn = async () => {
    setCheckInError("");
    setCheckInSuccess("");
    try {
      await checkInMutation.mutateAsync({ data: { note: note || null } });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/dashboard"] });
      setNote("");
      setCheckInSuccess("Kelish muvaffaqiyatli qayd etildi!");
    } catch (e: any) {
      setCheckInError(e?.response?.data?.message || e?.message || "Xatolik yuz berdi");
    }
  };

  const handleCheckOut = async () => {
    setCheckOutError("");
    setCheckOutSuccess("");
    try {
      await checkOutMutation.mutateAsync({ data: { note: note || null } });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/dashboard"] });
      setNote("");
      setCheckOutSuccess("Ketish muvaffaqiyatli qayd etildi!");
    } catch (e: any) {
      setCheckOutError(e?.response?.data?.message || e?.message || "Xatolik yuz berdi");
    }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString("uz-UZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const checkedIn = today?.checkedIn ?? false;
  const checkedOut = today?.checkedOut ?? false;

  return (
    <div className="max-w-3xl mx-auto pt-4 md:pt-10">
      <div className="bg-card border border-border/50 rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/80 px-8 pt-10 pb-16 text-center relative">
          <div className="absolute inset-0 opacity-10">
            <div className="w-64 h-64 rounded-full border-4 border-white absolute -top-16 -right-16" />
            <div className="w-40 h-40 rounded-full border-4 border-white absolute -bottom-8 -left-8" />
          </div>
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/30">
              <Clock className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl font-bold text-white font-mono tracking-widest mb-2">{timeStr}</h1>
            <p className="text-white/80 font-medium flex items-center gap-2 justify-center text-sm">
              <CalendarIcon className="w-4 h-4" /> {dateStr}
            </p>
          </div>
        </div>

        <div className="-mt-8 px-8 pb-8">
          <div className="bg-card border border-border rounded-2xl shadow-lg p-6 mb-6">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Bugungi holat</h3>

            {isLoading ? (
              <div className="space-y-3">
                <div className="h-10 bg-muted animate-pulse rounded-xl" />
                <div className="h-10 bg-muted animate-pulse rounded-xl" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${checkedIn ? "bg-green-500 shadow-lg shadow-green-500/50" : "bg-muted-foreground/30"}`} />
                    <span className="font-semibold text-sm">Kelish vaqti</span>
                  </div>
                  <span className={`font-mono font-bold px-3 py-1.5 rounded-lg text-sm border ${checkedIn ? "bg-green-50 border-green-200 text-green-700" : "bg-background border-border text-muted-foreground"}`}>
                    {today?.checkInTime ? formatTime(today.checkInTime) : "--:--"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${checkedOut ? "bg-orange-500 shadow-lg shadow-orange-500/50" : "bg-muted-foreground/30"}`} />
                    <span className="font-semibold text-sm">Ketish vaqti</span>
                  </div>
                  <span className={`font-mono font-bold px-3 py-1.5 rounded-lg text-sm border ${checkedOut ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-background border-border text-muted-foreground"}`}>
                    {today?.checkOutTime ? formatTime(today.checkOutTime) : "--:--"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {(checkInError || checkOutError) && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-medium">
              {checkInError || checkOutError}
            </div>
          )}
          {(checkInSuccess || checkOutSuccess) && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> {checkInSuccess || checkOutSuccess}
            </div>
          )}

          {!checkedOut && (
            <div className="mb-4">
              <label className="text-sm font-medium text-foreground block mb-2">Izoh (ixtiyoriy)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Masalan: Uydan ishlayapman..."
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
            </div>
          )}

          {isLoading ? (
            <div className="h-14 bg-muted animate-pulse rounded-xl" />
          ) : !checkedIn ? (
            <button
              onClick={handleCheckIn}
              disabled={checkInMutation.isPending}
              className="w-full py-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
            >
              <LogIn className="w-6 h-6" />
              {checkInMutation.isPending ? "Qayd etilmoqda..." : "Kelishni qayd etish"}
            </button>
          ) : !checkedOut ? (
            <button
              onClick={handleCheckOut}
              disabled={checkOutMutation.isPending}
              className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-orange-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
            >
              <LogOut className="w-6 h-6" />
              {checkOutMutation.isPending ? "Qayd etilmoqda..." : "Ketishni qayd etish"}
            </button>
          ) : (
            <div className="w-full py-4 bg-green-50 border-2 border-green-200 text-green-700 rounded-xl font-bold text-lg flex items-center justify-center gap-3">
              <CheckCircle className="w-6 h-6" />
              Bugungi ish kuni yakunlandi!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

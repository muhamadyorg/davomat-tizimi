import React, { useState } from "react";
import { useGetTodayAttendance, useCheckIn, useCheckOut } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, Clock, Calendar as CalendarIcon, MapPin } from "lucide-react";
import { formatTime } from "@/lib/utils";

export default function CheckInOut() {
  const queryClient = useQueryClient();
  const { data: today, isLoading } = useGetTodayAttendance();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();
  
  const [note, setNote] = useState("");

  const handleCheckIn = async () => {
    try {
      await checkInMutation.mutateAsync({ data: { note } });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      setNote("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheckOut = async () => {
    try {
      await checkOutMutation.mutateAsync({ data: { note } });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      setNote("");
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) return <div className="animate-pulse h-64 bg-card rounded-2xl w-full max-w-2xl mx-auto mt-10"></div>;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  // Real-time clock display
  const [timeStr, setTimeStr] = React.useState(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="max-w-3xl mx-auto pt-4 md:pt-10">
      <div className="bg-card border border-border/50 rounded-3xl shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-primary to-primary/80 z-0" />
        
        <div className="relative z-10 p-8 pt-12 flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-white rounded-full shadow-lg flex items-center justify-center mb-6 border-4 border-white">
            <Clock className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-4xl font-bold font-display text-foreground mb-2 tracking-tight">
            {timeStr}
          </h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2 justify-center">
            <CalendarIcon className="w-4 h-4" /> {dateStr}
          </p>

          <div className="w-full max-w-md mt-10 space-y-6">
            
            {/* Status Indicator */}
            <div className="bg-muted/50 rounded-2xl p-5 border border-border/50 text-left">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Today's Record</h3>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${today?.checkInTime ? 'bg-success' : 'bg-muted-foreground'}`} />
                  <span className="font-medium">Check In</span>
                </div>
                <span className="font-mono bg-background px-3 py-1 rounded-lg border border-border">
                  {today?.checkInTime ? formatTime(today.checkInTime) : '--:--'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${today?.checkOutTime ? 'bg-orange-500' : 'bg-muted-foreground'}`} />
                  <span className="font-medium">Check Out</span>
                </div>
                <span className="font-mono bg-background px-3 py-1 rounded-lg border border-border">
                  {today?.checkOutTime ? formatTime(today.checkOutTime) : '--:--'}
                </span>
              </div>
            </div>

            {/* Note Input */}
            {(!today?.checkedIn || (today?.checkedIn && !today?.checkedOut)) && (
              <div className="space-y-2 text-left">
                <label className="text-sm font-medium text-foreground ml-1">Add a note (optional)</label>
                <input 
                  type="text" 
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="E.g., Working from home today"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-1 gap-4 pt-2">
              {!today?.checkedIn ? (
                <button
                  onClick={handleCheckIn}
                  disabled={checkInMutation.isPending}
                  className="w-full py-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <LogIn className="w-6 h-6" />
                  {checkInMutation.isPending ? "Recording..." : "Check In Now"}
                </button>
              ) : !today?.checkedOut ? (
                <button
                  onClick={handleCheckOut}
                  disabled={checkOutMutation.isPending}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <LogOut className="w-6 h-6" />
                  {checkOutMutation.isPending ? "Recording..." : "Check Out Now"}
                </button>
              ) : (
                <div className="w-full py-4 bg-success/10 text-success rounded-xl font-bold text-lg border border-success/20 flex items-center justify-center gap-3">
                  <CheckCircle2 className="w-6 h-6" />
                  Done for today
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function CheckCircle2(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>;
}

import React, { useState } from "react";
import { useListShifts, useCreateShift } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Timer, Plus, Clock, AlertCircle } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  startTime: z.string(),
  endTime: z.string(),
  lateThresholdMinutes: z.coerce.number().min(0),
  workDays: z.array(z.coerce.number()).min(1, "Select at least one day"),
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Shifts() {
  const { data: shifts, isLoading } = useListShifts();
  const createMutation = useCreateShift();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { workDays: [1, 2, 3, 4, 5], lateThresholdMinutes: 15 }
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      await createMutation.mutateAsync({ data });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      setIsAddOpen(false);
      form.reset();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display">Work Shifts</h1>
          <p className="text-muted-foreground mt-1">Configure working hours and schedules.</p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="px-5 py-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/25 font-semibold flex items-center gap-2 hover:shadow-xl hover:-translate-y-0.5 transition-all"
        >
          <Plus className="w-5 h-5" /> New Shift
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-48 bg-card animate-pulse rounded-2xl border border-border/50" />)
        ) : (
          shifts?.map(shift => (
            <div key={shift.id} className="bg-card rounded-2xl p-6 shadow-sm border border-border/50 hover:border-primary/30 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center">
                    <Timer className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{shift.name}</h3>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-muted/50 p-3 rounded-xl border border-border/50">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div className="font-mono font-semibold text-lg">
                    {shift.startTime.slice(0,5)} - {shift.endTime.slice(0,5)}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Active Days</p>
                  <div className="flex gap-1.5">
                    {DAYS.map((day, i) => (
                      <div 
                        key={i} 
                        className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${shift.workDays.includes(i) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground opacity-50'}`}
                      >
                        {day[0]}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-warning font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Grace period: {shift.lateThresholdMinutes} mins
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Create Work Shift">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1">
            <label className="text-sm font-medium">Shift Name</label>
            <input {...form.register("name")} className="w-full px-4 py-3 bg-background border rounded-xl" placeholder="e.g. Standard Morning" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Start Time</label>
              <input type="time" {...form.register("startTime")} className="w-full px-4 py-3 bg-background border rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">End Time</label>
              <input type="time" {...form.register("endTime")} className="w-full px-4 py-3 bg-background border rounded-xl" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Late Grace Period (minutes)</label>
            <input type="number" {...form.register("lateThresholdMinutes")} className="w-full px-4 py-3 bg-background border rounded-xl" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Work Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day, i) => (
                <label key={i} className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg border border-border/50 cursor-pointer">
                  <input type="checkbox" value={i} {...form.register("workDays")} className="w-4 h-4 text-primary rounded" />
                  <span className="text-sm font-medium">{day}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-xl font-medium">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-6 py-2 bg-primary text-white rounded-xl font-medium shadow-md">
              Save Shift
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

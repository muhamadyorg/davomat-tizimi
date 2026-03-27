import React, { useState } from "react";
import { useListLeaveRequests, useCreateLeaveRequest, useUpdateLeaveRequest } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Check, X, Calendar as CalIcon } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getStatusColor } from "@/lib/utils";

const schema = z.object({
  leaveType: z.enum(["sick", "vacation", "personal", "other"]),
  startDate: z.string().min(1, "Start date required"),
  endDate: z.string().min(1, "End date required"),
  reason: z.string().min(5, "Please provide a reason"),
});

export default function LeaveRequests() {
  const { user } = useAuth();
  const isAdmin = user?.role === "superadmin" || user?.role === "admin";
  
  const { data: requests, isLoading } = useListLeaveRequests({});
  const createMutation = useCreateLeaveRequest();
  const updateMutation = useUpdateLeaveRequest();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { leaveType: "vacation" }
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      await createMutation.mutateAsync({ data });
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      setIsAddOpen(false);
      form.reset();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAction = async (id: number, status: "approved" | "rejected") => {
    try {
      await updateMutation.mutateAsync({ id, data: { status } });
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display">Leave Requests</h1>
          <p className="text-muted-foreground mt-1">Manage time off, vacations, and sick leaves.</p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="px-5 py-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/25 font-semibold flex items-center gap-2 hover:shadow-xl hover:-translate-y-0.5 transition-all"
        >
          <Plus className="w-5 h-5" /> Request Leave
        </button>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border/50">
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Dates</th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Reason</th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                {isAdmin && <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : !requests?.length ? (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">No leave requests found.</td></tr>
              ) : (
                requests.map(req => (
                  <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-semibold text-sm">{req.userFullName}</td>
                    <td className="px-6 py-4 capitalize text-sm">{req.leaveType}</td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CalIcon className="w-4 h-4" />
                        {format(new Date(req.startDate), 'MMM d, yyyy')} - {format(new Date(req.endDate), 'MMM d, yyyy')}
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 block">({req.days} days)</span>
                    </td>
                    <td className="px-6 py-4 text-sm max-w-[200px] truncate" title={req.reason}>{req.reason}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getStatusColor(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        {req.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleAction(req.id, 'approved')} className="p-2 bg-success/10 text-success hover:bg-success hover:text-white rounded-lg transition-colors">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleAction(req.id, 'rejected')} className="p-2 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white rounded-lg transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Processed</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Submit Leave Request">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Leave Type</label>
            <select {...form.register("leaveType")} className="w-full px-4 py-3 bg-background border rounded-xl">
              <option value="vacation">Vacation</option>
              <option value="sick">Sick Leave</option>
              <option value="personal">Personal Reason</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Start Date</label>
              <input type="date" {...form.register("startDate")} className="w-full px-4 py-3 bg-background border rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">End Date</label>
              <input type="date" {...form.register("endDate")} className="w-full px-4 py-3 bg-background border rounded-xl" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Reason</label>
            <textarea {...form.register("reason")} rows={4} className="w-full px-4 py-3 bg-background border rounded-xl resize-none" placeholder="Provide details..." />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-xl font-medium">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-6 py-2 bg-primary text-white rounded-xl font-medium shadow-md">
              Submit
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

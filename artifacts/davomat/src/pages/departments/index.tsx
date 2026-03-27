import React, { useState } from "react";
import { useListDepartments, useCreateDepartment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Users } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
});

export default function Departments() {
  const { data: departments, isLoading } = useListDepartments();
  const createMutation = useCreateDepartment();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      await createMutation.mutateAsync({ data });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display">Departments</h1>
          <p className="text-muted-foreground mt-1">Manage company organizational structure.</p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="px-5 py-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/25 font-semibold flex items-center gap-2 hover:shadow-xl hover:-translate-y-0.5 transition-all"
        >
          <Plus className="w-5 h-5" /> Add Department
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-40 bg-card animate-pulse rounded-2xl border border-border/50" />)
        ) : (
          departments?.map(dept => (
            <div key={dept.id} className="bg-card rounded-2xl p-6 shadow-sm border border-border/50 hover:shadow-md transition-shadow flex flex-col h-full">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{dept.name}</h3>
              <p className="text-muted-foreground text-sm flex-1">{dept.description || "No description provided."}</p>
              
              <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  {dept.employeeCount} Employees
                </div>
                {dept.managerName && (
                  <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                    Mgr: {dept.managerName}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Create Department">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Department Name</label>
            <input 
              {...form.register("name")} 
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all" 
              placeholder="e.g. Engineering"
            />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Description</label>
            <textarea 
              {...form.register("description")} 
              rows={3}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all resize-none" 
              placeholder="Brief description..."
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-xl font-medium">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-6 py-2 bg-primary text-white rounded-xl font-medium shadow-md">
              {createMutation.isPending ? "Creating..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

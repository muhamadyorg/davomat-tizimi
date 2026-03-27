import React, { useState } from "react";
import { useListUsers, useCreateUser, useListDepartments, useListShifts } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Filter, Mail, Phone, MoreVertical } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  role: z.enum(["superadmin", "admin", "employee"]),
  departmentId: z.coerce.number().optional().or(z.literal(0)),
  shiftId: z.coerce.number().optional().or(z.literal(0)),
  position: z.string().optional(),
});

export default function Employees() {
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: users, isLoading } = useListUsers({ search });
  const { data: departments } = useListDepartments();
  const { data: shifts } = useListShifts();
  
  const createMutation = useCreateUser();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: "employee",
      departmentId: 0,
      shiftId: 0,
    }
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      const payload = {
        ...data,
        departmentId: data.departmentId || null,
        shiftId: data.shiftId || null,
      };
      await createMutation.mutateAsync({ data: payload as any });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display">Employees</h1>
          <p className="text-muted-foreground mt-1">Manage staff, roles, and assignments.</p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="px-5 py-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/25 font-semibold flex items-center gap-2 hover:shadow-xl hover:-translate-y-0.5 transition-all"
        >
          <Plus className="w-5 h-5" /> Add Employee
        </button>
      </div>

      <div className="bg-card p-2 rounded-2xl shadow-sm border border-border/50 flex gap-2 w-full max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search by name or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-transparent border-none focus:outline-none focus:ring-0 text-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          [...Array(6)].map((_, i) => <div key={i} className="h-48 bg-card animate-pulse rounded-2xl border border-border/50" />)
        ) : (
          users?.map((user) => (
            <div key={user.id} className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group relative">
              <button className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted rounded-full opacity-0 group-hover:opacity-100 transition-all">
                <MoreVertical className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center font-bold text-xl border border-primary/20">
                  {user.firstName[0]}{user.lastName[0]}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">{user.firstName} {user.lastName}</h3>
                  <p className="text-sm font-medium text-primary">{user.position || user.role}</p>
                </div>
              </div>
              <div className="space-y-2 mt-6">
                {user.email && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" /> {user.email}
                  </div>
                )}
                {user.phone && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" /> {user.phone}
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-success' : 'bg-destructive'}`} />
                  {user.isActive ? 'Active' : 'Inactive'} • {user.departmentName || 'No Dept'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add New Employee">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">First Name</label>
              <input {...form.register("firstName")} className="w-full px-3 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Last Name</label>
              <input {...form.register("lastName")} className="w-full px-3 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Username</label>
              <input {...form.register("username")} className="w-full px-3 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Password</label>
              <input type="password" {...form.register("password")} className="w-full px-3 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <input {...form.register("email")} className="w-full px-3 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Phone</label>
              <input {...form.register("phone")} className="w-full px-3 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Role</label>
              <select {...form.register("role")} className="w-full px-3 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary/20">
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Position</label>
              <input {...form.register("position")} className="w-full px-3 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Department</label>
              <select {...form.register("departmentId")} className="w-full px-3 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary/20">
                <option value="0">None</option>
                {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Shift</label>
              <select {...form.register("shiftId")} className="w-full px-3 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary/20">
                <option value="0">None</option>
                {shifts?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-xl font-medium transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending} className="px-6 py-2 bg-primary text-white rounded-xl font-medium shadow-md shadow-primary/20 hover:shadow-lg disabled:opacity-50">
              {createMutation.isPending ? "Creating..." : "Create Employee"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

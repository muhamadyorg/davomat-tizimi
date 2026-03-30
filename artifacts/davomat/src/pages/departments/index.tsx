import React, { useState } from "react";
import {
  useListDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Users, X, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2, "Nom kamida 2 ta harf bo'lishi kerak"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Department {
  id: number;
  name: string;
  description?: string | null;
  employeeCount?: number;
  managerName?: string | null;
}

export default function Departments() {
  const { data: departments, isLoading } = useListDepartments();
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deleteDept, setDeleteDept] = useState<Department | null>(null);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });
  const editForm = useForm<FormData>({ resolver: zodResolver(schema) });

  const onAdd = async (data: FormData) => {
    try {
      await createMutation.mutateAsync({ data });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setIsAddOpen(false);
      form.reset();
    } catch (e) {
      console.error(e);
    }
  };

  const openEdit = (dept: Department) => {
    setEditDept(dept);
    editForm.reset({ name: dept.name, description: dept.description || "" });
  };

  const onEdit = async (data: FormData) => {
    if (!editDept) return;
    try {
      await updateMutation.mutateAsync({ id: editDept.id, data });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setEditDept(null);
    } catch (e) {
      console.error(e);
    }
  };

  const onDelete = async () => {
    if (!deleteDept) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteDept.id });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setDeleteDept(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Bo'limlar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Tashkilot tuzilmasini boshqaring</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 bg-primary text-white rounded-xl font-semibold shadow-md shadow-primary/20 flex items-center gap-2 hover:bg-primary/90 transition-all text-sm"
          >
            <Plus className="w-4 h-4" /> Bo'lim qo'shish
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="h-40 bg-card animate-pulse rounded-2xl border border-border/50" />
          ))
        ) : (
          departments?.map((dept) => (
            <div
              key={dept.id}
              className="bg-card rounded-2xl p-6 shadow-sm border border-border/50 hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                {isSuperAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(dept as Department)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Tahrirlash"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteDept(dept as Department)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="O'chirish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">{dept.name}</h3>
              <p className="text-muted-foreground text-sm flex-1">
                {dept.description || "Tavsif kiritilmagan."}
              </p>
              <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{dept.employeeCount ?? 0} xodim</span>
                {dept.managerName && (
                  <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-md">
                    {dept.managerName}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg font-display">Yangi bo'lim</h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={form.handleSubmit(onAdd)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Bo'lim nomi *
                </label>
                <input
                  {...form.register("name")}
                  placeholder="Masalan: IT bo'limi"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive flex gap-1">
                    <AlertCircle className="w-3 h-3 mt-0.5" />
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Tavsif</label>
                <textarea
                  {...form.register("description")}
                  rows={3}
                  placeholder="Qisqacha tavsif..."
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 py-2.5 bg-muted text-foreground rounded-xl font-semibold text-sm"
                >
                  Bekor
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50"
                >
                  {createMutation.isPending ? "Qo'shilmoqda..." : "Qo'shish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg font-display">Bo'limni tahrirlash</h3>
              <button
                onClick={() => setEditDept(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Bo'lim nomi *
                </label>
                <input
                  {...editForm.register("name")}
                  placeholder="Masalan: IT bo'limi"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                />
                {editForm.formState.errors.name && (
                  <p className="text-xs text-destructive flex gap-1">
                    <AlertCircle className="w-3 h-3 mt-0.5" />
                    {editForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Tavsif</label>
                <textarea
                  {...editForm.register("description")}
                  rows={3}
                  placeholder="Qisqacha tavsif..."
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setEditDept(null)}
                  className="flex-1 py-2.5 bg-muted text-foreground rounded-xl font-semibold text-sm"
                >
                  Bekor
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg font-display">O'chirishni tasdiqlang</h3>
                <p className="text-sm text-muted-foreground">Bu amalni qaytarib bo'lmaydi</p>
              </div>
            </div>
            <p className="text-sm text-foreground mb-6">
              <span className="font-semibold">"{deleteDept.name}"</span> bo'limini o'chirmoqchimisiz?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteDept(null)}
                className="flex-1 py-2.5 bg-muted text-foreground rounded-xl font-semibold text-sm"
              >
                Bekor
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 bg-destructive text-white rounded-xl font-semibold text-sm disabled:opacity-50"
              >
                {deleteMutation.isPending ? "O'chirilmoqda..." : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

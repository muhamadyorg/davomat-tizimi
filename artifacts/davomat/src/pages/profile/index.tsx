import React, { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useChangeUserPassword } from "@workspace/api-client-react";
import { User, Lock, Mail, Phone, Building2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Profile() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const mutation = useChangeUserPassword();
  const queryClient = useQueryClient();

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    try {
      await mutation.mutateAsync({
        id: user.id,
        data: { currentPassword, newPassword }
      });
      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update password");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display mb-8">My Profile</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="md:col-span-1 space-y-6">
          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm text-center">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-primary/80 text-white flex items-center justify-center font-bold text-4xl mb-4 shadow-lg">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <h2 className="text-xl font-bold text-foreground font-display">{user.firstName} {user.lastName}</h2>
            <p className="text-primary font-medium text-sm mt-1 uppercase tracking-wider">{user.position || user.role}</p>
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-bold uppercase">
              <div className="w-2 h-2 rounded-full bg-success" /> Active
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-foreground border-b border-border/50 pb-2 mb-4">Contact Info</h3>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <User className="w-4 h-4 text-primary" /> @{user.username}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Mail className="w-4 h-4 text-primary" /> {user.email || 'No email'}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Phone className="w-4 h-4 text-primary" /> {user.phone || 'No phone'}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Building2 className="w-4 h-4 text-primary" /> {user.departmentName || 'No Department'}
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b border-border/50 pb-4">
              <Lock className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold text-foreground font-display">Change Password</h3>
            </div>

            {error && <div className="mb-6 p-3 bg-destructive/10 text-destructive rounded-lg text-sm font-medium">{error}</div>}
            {success && <div className="mb-6 p-3 bg-success/10 text-success rounded-lg text-sm font-medium">{success}</div>}

            <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
              <div className="space-y-1">
                <label className="text-sm font-medium">Current Password</label>
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20" 
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">New Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20" 
                  required minLength={6}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Confirm New Password</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20" 
                  required minLength={6}
                />
              </div>
              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={mutation.isPending}
                  className="px-6 py-3 bg-primary text-white rounded-xl font-medium shadow-md shadow-primary/20 disabled:opacity-50"
                >
                  {mutation.isPending ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}

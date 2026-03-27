import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'present': return 'bg-success/10 text-success border-success/20';
    case 'absent': return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'late': return 'bg-warning/10 text-warning-foreground border-warning/20';
    case 'early_leave': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    case 'on_leave': return 'bg-primary/10 text-primary border-primary/20';
    case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case 'approved': return 'bg-success/10 text-success border-success/20';
    case 'rejected': return 'bg-destructive/10 text-destructive border-destructive/20';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

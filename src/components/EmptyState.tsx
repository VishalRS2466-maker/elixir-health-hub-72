import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-soft flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const tone =
    status === "approved" || status === "confirmed" || status === "taken" || status === "booked"
      ? "bg-success-soft text-foreground"
      : status === "rejected" || status === "cancelled" || status === "skipped" || status === "revoked"
        ? "bg-emergency-soft text-foreground"
        : "bg-warm-soft text-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tone}`}>
      {status.replace("_", " ")}
    </span>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import * as AuditService from "@/services/audit";
import { EmptyState, StatusChip } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/app/activity")({
  head: () => ({
    meta: [
      { title: "Access activity · ELIXIR" },
      { name: "description", content: "An audit trail of who accessed your health data, what they saw and when." },
      { property: "og:title", content: "Access activity · ELIXIR" },
      { property: "og:description", content: "Every access to your records is logged and visible to you." },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { user, role, profile } = useSession();
  const isAdmin = role === "admin";

  const logs = useQuery({
    queryKey: ["audit", user?.id, role],
    queryFn: () => (isAdmin ? AuditService.listAll() : AuditService.listForPatient(user!.id)),
    enabled: !!user,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{isAdmin ? "System audit logs" : "Access activity"}</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "Every recorded action across ELIXIR."
            : `Everything that happened to ${profile?.full_name ?? "your"} health data.`}
        </p>
      </div>

      {logs.isLoading && <p className="text-sm text-muted-foreground">Loading activity…</p>}
      {!logs.isLoading && (logs.data ?? []).length === 0 && (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Actions like record edits, bookings and consent decisions will show here."
        />
      )}

      <ol className="space-y-2">
        {(logs.data ?? []).map((l) => (
          <li key={l.id} className="card-soft p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{l.action}</p>
                <p className="text-xs text-muted-foreground">
                  {l.actor_name} ({l.actor_role}) · {l.resource || "—"}
                </p>
                {l.details && <p className="text-xs text-muted-foreground">{l.details}</p>}
              </div>
              <div className="text-right">
                {l.consent_status && <StatusChip status={l.consent_status} />}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { doctorOverview } from "@/lib/doctor.functions";
import { categoryLabel } from "@/lib/constants";
import { EmptyState, StatusChip } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/doctor/consent")({
  component: DoctorConsent,
});

function DoctorConsent() {
  const fn = useServerFn(doctorOverview);
  const overview = useQuery({ queryKey: ["doctor-overview"], queryFn: () => fn({}) });
  const rows = overview.data?.requests ?? [];
  const active = rows.filter(
    (r) => r.status === "approved" && (!r.expires_at || new Date(r.expires_at) > new Date()),
  );
  const inactive = rows.filter((r) => !active.includes(r));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Consent management</h1>
        <p className="text-sm text-muted-foreground">
          Consent is granted, scoped and revoked by the user. You can only see what is currently active.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Active consent</h2>
        {active.length === 0 && (
          <EmptyState icon={ShieldCheck} title="No active consent" description="Approved access will be listed here." />
        )}
        {active.map((r) => (
          <article key={r.id} className="card-soft flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{r.patient_name}</p>
              <p className="text-xs text-muted-foreground">{r.approved_categories.map(categoryLabel).join(", ")}</p>
              <p className="text-xs text-muted-foreground">
                {r.expires_at ? `Expires ${new Date(r.expires_at).toLocaleString()}` : "No expiry set"}
              </p>
            </div>
            <Link
              to="/doctor/patients/$patientId"
              params={{ patientId: r.patient_id }}
              className="text-sm font-medium text-primary"
            >
              Open clinical view →
            </Link>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pending, expired & revoked</h2>
        {inactive.length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}
        {inactive.map((r) => (
          <article key={r.id} className="card-soft flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{r.patient_name}</p>
              <p className="text-xs text-muted-foreground">
                {(r.status === "approved" ? r.approved_categories : r.requested_categories)
                  .map(categoryLabel)
                  .join(", ")}
              </p>
            </div>
            <StatusChip status={r.status === "approved" ? "expired" : r.status} />
          </article>
        ))}
      </section>
    </div>
  );
}

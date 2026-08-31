import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import * as ConsentService from "@/services/consent";
import * as AuditService from "@/services/audit";
import { CONSENT_CATEGORIES, categoryLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, StatusChip } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/app/consent")({
  head: () => ({
    meta: [
      { title: "Consent · ELIXIR" },
      { name: "description", content: "Approve, limit or revoke doctor access to your medical records." },
      { property: "og:title", content: "Consent · ELIXIR" },
      { property: "og:description", content: "You decide which records a doctor can see, and for how long." },
    ],
  }),
  component: ConsentPage,
});

function ConsentPage() {
  const { user, profile } = useSession();
  const qc = useQueryClient();
  const [selection, setSelection] = useState<Record<string, string[]>>({});
  const [duration, setDuration] = useState<Record<string, number>>({});

  const requests = useQuery({
    queryKey: ["consent", user?.id],
    queryFn: () => ConsentService.listPatientRequests(user!.id),
    enabled: !!user,
  });

  const pending = (requests.data ?? []).filter((r) => r.status === "pending");
  const decided = (requests.data ?? []).filter((r) => r.status !== "pending");

  async function respond(id: string, status: "approved" | "rejected", requested: string[], doctorName: string) {
    const chosen = selection[id] ?? requested;
    const days = duration[id] ?? 30;
    if (status === "approved" && chosen.length === 0) {
      toast.error("Select at least one category to approve");
      return;
    }
    await ConsentService.respond(id, status, chosen, days);
    if (user)
      await AuditService.log({
        actorId: user.id,
        actorName: profile?.full_name ?? "Patient",
        actorRole: "patient",
        patientId: user.id,
        action: status === "approved" ? "Approved record access" : "Rejected record access",
        resource: status === "approved" ? chosen.map(categoryLabel).join(", ") : "None",
        consentStatus: status,
        details: `${doctorName} · ${status === "approved" ? `${days} days` : "no access"}`,
      });
    await qc.invalidateQueries({ queryKey: ["consent", user?.id] });
    toast.success(status === "approved" ? "Access approved" : "Request rejected");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Consent</h1>
        <p className="text-sm text-muted-foreground">
          Doctors can only view what you approve here — nothing else, and only until the access expires.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pending requests</h2>
        {pending.length === 0 && (
          <EmptyState
            icon={ShieldCheck}
            title="No pending requests"
            description="When a doctor requests access to your records, it will appear here."
          />
        )}
        {pending.map((r) => {
          const chosen = selection[r.id] ?? r.requested_categories;
          return (
            <article key={r.id} className="card-soft space-y-3 p-5">
              <div>
                <p className="font-semibold">{r.doctor_name} requested access to your medical records.</p>
                <p className="text-sm text-muted-foreground">Reason: {r.reason}</p>
                <p className="text-xs text-muted-foreground">
                  Requested on {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="space-y-2 rounded-2xl bg-muted p-3">
                <p className="text-sm font-semibold">Select what to share</p>
                {(r.requested_categories.length ? r.requested_categories : CONSENT_CATEGORIES.map((c) => c.value)).map(
                  (cat) => (
                    <label key={cat} className="flex items-center gap-3 text-sm">
                      <Checkbox
                        checked={chosen.includes(cat)}
                        onCheckedChange={(on) =>
                          setSelection({
                            ...selection,
                            [r.id]: on ? [...chosen, cat] : chosen.filter((c) => c !== cat),
                          })
                        }
                      />
                      {categoryLabel(cat)}
                    </label>
                  ),
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">Access duration</span>
                {[7, 30, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration({ ...duration, [r.id]: d })}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      (duration[r.id] ?? 30) === d ? "border-primary bg-brand-soft" : "bg-card"
                    }`}
                  >
                    {d} days
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 rounded-2xl"
                  onClick={() => respond(r.id, "approved", r.requested_categories, r.doctor_name)}
                >
                  Approve selected
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-2xl"
                  onClick={() => respond(r.id, "rejected", r.requested_categories, r.doctor_name)}
                >
                  Reject
                </Button>
              </div>
            </article>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Access history</h2>
        {decided.length === 0 && (
          <EmptyState icon={ShieldCheck} title="No decisions yet" description="Your consent decisions will be listed here." />
        )}
        {decided.map((r) => (
          <article key={r.id} className="card-soft p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{r.doctor_name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.approved_categories.length
                    ? r.approved_categories.map(categoryLabel).join(", ")
                    : "No categories shared"}
                </p>
                {r.expires_at && r.status === "approved" && (
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(r.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <StatusChip status={r.status} />
            </div>
            {r.status === "approved" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 rounded-full"
                onClick={async () => {
                  await ConsentService.revoke(r.id);
                  if (user)
                    await AuditService.log({
                      actorId: user.id,
                      actorName: profile?.full_name ?? "Patient",
                      actorRole: "patient",
                      patientId: user.id,
                      action: "Revoked record access",
                      resource: r.doctor_name,
                      consentStatus: "revoked",
                    });
                  await qc.invalidateQueries({ queryKey: ["consent", user?.id] });
                  toast.success("Access revoked");
                }}
              >
                Revoke access
              </Button>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

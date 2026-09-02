import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileHeart, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { doctorOverview } from "@/lib/doctor.functions";
import * as ConsentService from "@/services/consent";
import * as AuditService from "@/services/audit";
import { CONSENT_CATEGORIES, categoryLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, StatusChip } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/doctor/requests")({
  component: DoctorRequests,
});

function DoctorRequests() {
  const { user, profile } = useSession();
  const qc = useQueryClient();
  const fn = useServerFn(doctorOverview);
  const overview = useQuery({ queryKey: ["doctor-overview"], queryFn: () => fn({}) });

  const [lookup, setLookup] = useState("");
  const [found, setFound] = useState<{ id: string; full_name: string; universal_id: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reason, setReason] = useState("Consultation review");
  const [cats, setCats] = useState<string[]>(["consultation", "prescription", "lab_report"]);

  async function findPatient() {
    setNotFound(false);
    setFound(null);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, universal_id")
      .eq("universal_id", lookup.trim().toUpperCase())
      .maybeSingle();
    if (data) setFound(data);
    else setNotFound(true);
  }

  async function sendRequest() {
    if (!found || !user) return;
    if (cats.length === 0) {
      toast.error("Select at least one category");
      return;
    }
    try {
      await ConsentService.requestAccess({
        patient_id: found.id,
        doctor_user_id: user.id,
        doctor_name: profile?.full_name ?? "Doctor",
        reason,
        requested_categories: cats,
        status: "pending",
      });
      await AuditService.log({
        actorId: user.id,
        actorName: profile?.full_name ?? "Doctor",
        actorRole: "doctor",
        patientId: found.id,
        action: "Requested record access",
        resource: cats.map(categoryLabel).join(", "),
        consentStatus: "pending",
        details: reason,
      });
      await qc.invalidateQueries({ queryKey: ["doctor-overview"] });
      toast.success(`Request sent to ${found.full_name}`);
      setFound(null);
      setLookup("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the request");
    }
  }

  const requests = overview.data?.requests ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">User requests</h1>
        <p className="text-sm text-muted-foreground">
          Records open only after the user approves. Lookup shows nothing but the name and Universal ID.
        </p>
      </div>

      <section className="card-soft space-y-3 p-5">
        <h2 className="text-lg font-semibold">Request record access</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            className="min-w-52 flex-1"
            placeholder="Universal User ID (e.g. ELX-2024-000123)"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
          />
          <Button className="rounded-2xl" onClick={findPatient} disabled={lookup.trim().length < 4}>
            <Search className="mr-1 h-4 w-4" /> Find
          </Button>
        </div>
        {notFound && <p className="text-sm text-muted-foreground">No user found with that ID.</p>}
        {found && (
          <div className="space-y-3 rounded-2xl bg-muted p-4">
            <p className="font-semibold">
              {found.full_name} <span className="font-mono text-xs">{found.universal_id}</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason for access</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {CONSENT_CATEGORIES.map((c) => (
                <label key={c.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={cats.includes(c.value)}
                    onCheckedChange={(on) => setCats(on ? [...cats, c.value] : cats.filter((x) => x !== c.value))}
                  />
                  {c.label}
                </label>
              ))}
            </div>
            <Button className="rounded-2xl" onClick={sendRequest}>
              Send consent request
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">All requests</h2>
        {requests.length === 0 && (
          <EmptyState icon={FileHeart} title="No requests yet" description="Look up a Universal ID above." />
        )}
        {requests.map((r) => {
          const live = r.status === "approved" && (!r.expires_at || new Date(r.expires_at) > new Date());
          return (
            <article key={r.id} className="card-soft flex flex-wrap items-start justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{r.patient_name}</p>
                <p className="text-xs text-muted-foreground">
                  {(r.status === "approved" ? r.approved_categories : r.requested_categories)
                    .map(categoryLabel)
                    .join(", ")}
                </p>
                {r.expires_at && r.status === "approved" && (
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(r.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusChip status={live ? r.status : r.status === "approved" ? "expired" : r.status} />
                {live && (
                  <Link
                    to="/doctor/patients/$patientId"
                    params={{ patientId: r.patient_id }}
                    className="text-sm font-medium text-primary"
                  >
                    Open user →
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

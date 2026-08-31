import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, FileHeart, Search, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import * as DirectoryService from "@/services/directory";
import * as BookingService from "@/services/bookings";
import * as ConsentService from "@/services/consent";
import * as AuditService from "@/services/audit";
import * as RecordService from "@/services/records";
import { CONSENT_CATEGORIES, categoryLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, StatusChip } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/app/doctor")({
  head: () => ({
    meta: [
      { title: "Doctor dashboard · ELIXIR" },
      { name: "description", content: "Appointments, consent requests and consented patient records." },
      { property: "og:title", content: "Doctor dashboard · ELIXIR" },
      { property: "og:description", content: "Access patient records only with explicit, time-limited consent." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DoctorPage,
});

function DoctorPage() {
  const { user, profile, role } = useSession();
  const qc = useQueryClient();
  const [lookup, setLookup] = useState("");
  const [found, setFound] = useState<{ id: string; full_name: string; universal_id: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reason, setReason] = useState("Consultation review");
  const [cats, setCats] = useState<string[]>(["consultation", "prescription", "lab_report"]);
  const [openRecordsFor, setOpenRecordsFor] = useState<string | null>(null);

  const doctor = useQuery({
    queryKey: ["doctor-self", user?.id],
    queryFn: () => DirectoryService.getDoctorByUser(user!.id),
    enabled: !!user,
  });

  const appointments = useQuery({
    queryKey: ["doctor-appointments", doctor.data?.id],
    queryFn: () => BookingService.listDoctorAppointments(doctor.data!.id),
    enabled: !!doctor.data?.id,
  });

  const requests = useQuery({
    queryKey: ["doctor-consent", user?.id],
    queryFn: () => ConsentService.listDoctorRequests(user!.id),
    enabled: !!user,
  });

  const approved = (requests.data ?? []).filter(
    (r) => r.status === "approved" && (!r.expires_at || new Date(r.expires_at) > new Date()),
  );

  const records = useQuery({
    queryKey: ["doctor-records", openRecordsFor],
    queryFn: () => RecordService.listRecords(openRecordsFor!),
    enabled: !!openRecordsFor,
  });

  if (role !== "doctor") {
    return (
      <EmptyState
        icon={Stethoscope}
        title="Doctors only"
        description="This dashboard is available to accounts registered as a doctor."
      />
    );
  }

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
    await qc.invalidateQueries({ queryKey: ["doctor-consent", user.id] });
    toast.success(`Request sent to ${found.full_name}`);
    setFound(null);
    setLookup("");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Doctor dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {doctor.data?.specialty ?? "Clinician"} · You can only open records a patient has approved.
        </p>
      </div>

      <section className="card-soft space-y-3 p-5">
        <h2 className="text-lg font-semibold">Request patient records</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            className="min-w-52 flex-1"
            placeholder="Universal Patient ID (e.g. ELX-2024-000123)"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
          />
          <Button className="rounded-2xl" onClick={findPatient} disabled={lookup.trim().length < 4}>
            <Search className="mr-1 h-4 w-4" /> Find
          </Button>
        </div>
        {notFound && <p className="text-sm text-muted-foreground">No patient found with that ID.</p>}
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
                    onCheckedChange={(on) =>
                      setCats(on ? [...cats, c.value] : cats.filter((x) => x !== c.value))
                    }
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
        <h2 className="text-lg font-semibold">Consent requests</h2>
        {(requests.data ?? []).length === 0 && (
          <EmptyState icon={FileHeart} title="No requests yet" description="Look up a patient ID above to request access." />
        )}
        {(requests.data ?? []).map((r) => (
          <article key={r.id} className="card-soft p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">Patient {r.patient_id.slice(0, 8)}…</p>
                <p className="text-xs text-muted-foreground">
                  {r.status === "approved"
                    ? r.approved_categories.map(categoryLabel).join(", ")
                    : r.requested_categories.map(categoryLabel).join(", ")}
                </p>
                {r.expires_at && r.status === "approved" && (
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(r.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <StatusChip status={r.status} />
            </div>
            {approved.some((a) => a.id === r.id) && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3 rounded-full"
                onClick={async () => {
                  const next = openRecordsFor === r.patient_id ? null : r.patient_id;
                  setOpenRecordsFor(next);
                  if (next && user)
                    await AuditService.log({
                      actorId: user.id,
                      actorName: profile?.full_name ?? "Doctor",
                      actorRole: "doctor",
                      patientId: r.patient_id,
                      action: "Viewed medical records",
                      resource: r.approved_categories.map(categoryLabel).join(", "),
                      consentStatus: "approved",
                    });
                }}
              >
                {openRecordsFor === r.patient_id ? "Hide records" : "View shared records"}
              </Button>
            )}
            {openRecordsFor === r.patient_id && (
              <ul className="mt-3 space-y-2">
                {(records.data ?? [])
                  .filter((rec) => r.approved_categories.includes(rec.category))
                  .map((rec) => (
                    <li key={rec.id} className="rounded-xl border p-3">
                      <p className="text-sm font-medium">{rec.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {categoryLabel(rec.category)} · {new Date(rec.record_date).toLocaleDateString()}
                      </p>
                      {rec.description && <p className="mt-1 text-sm">{rec.description}</p>}
                    </li>
                  ))}
                {(records.data ?? []).filter((rec) => r.approved_categories.includes(rec.category)).length ===
                  0 && <p className="text-sm text-muted-foreground">No records in the approved categories.</p>}
              </ul>
            )}
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Appointments</h2>
        {(appointments.data ?? []).length === 0 && (
          <EmptyState icon={CalendarDays} title="No appointments" description="Patient bookings for you will appear here." />
        )}
        {(appointments.data ?? []).map((a) => (
          <article key={a.id} className="card-soft flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{a.profiles?.full_name ?? "Patient"}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(a.slot_at).toLocaleString()} · {a.mode}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusChip status={a.status} />
              {a.status !== "completed" && (
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={async () => {
                    await BookingService.setAppointmentStatus(a.id, "completed");
                    await qc.invalidateQueries({ queryKey: ["doctor-appointments", doctor.data?.id] });
                    toast.success("Marked completed");
                  }}
                >
                  Complete
                </Button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

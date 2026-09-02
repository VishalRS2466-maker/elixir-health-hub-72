import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { doctorAddRecord, doctorPatientView } from "@/lib/doctor.functions";
import { RECORD_CATEGORIES, categoryLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, StatusChip } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/doctor/patients/$patientId")({
  component: PatientClinicalView,
});

function PatientClinicalView() {
  const { patientId } = Route.useParams();
  const qc = useQueryClient();
  const viewFn = useServerFn(doctorPatientView);
  const addFn = useServerFn(doctorAddRecord);

  const view = useQuery({
    queryKey: ["doctor-user-view", patientId],
    queryFn: () => viewFn({ data: { patientId } }),
  });

  const [category, setCategory] = useState("consultation");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  if (view.isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;

  if (!view.data?.authorized) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Access denied"
        description="This user has not granted you active consent, or the consent expired or was revoked."
      />
    );
  }

  const { profile, records, medicines, appointments, categories } = view.data;
  const bySection = (cats: string[]) => records.filter((r: any) => cats.includes(r.category));
  const permittedRecordCats = RECORD_CATEGORIES.filter((c) => categories.includes(c.value));

  async function save() {
    if (title.trim().length < 3) {
      toast.error("Add a title");
      return;
    }
    setSaving(true);
    try {
      await addFn({ data: { patientId, category, title, description } });
      toast.success("Record added and audited");
      setTitle("");
      setDescription("");
      await qc.invalidateQueries({ queryKey: ["doctor-user-view", patientId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save record");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{profile?.full_name ?? "User"}</h1>
          <p className="font-mono text-xs text-muted-foreground">{profile?.universal_id}</p>
          <p className="text-sm text-muted-foreground">
            {[profile?.gender, profile?.blood_group, profile?.dob ? `DOB ${profile.dob}` : null]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>
        <Link to="/doctor/ai" search={{}} className="text-sm font-medium text-primary">
          Open AI clinical assistant →
        </Link>
      </div>

      <div className="card-soft flex flex-wrap items-center gap-2 p-4">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Consent active for:</span>
        {categories.map((c: string) => (
          <span key={c} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium">
            {categoryLabel(c)}
          </span>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {[
            { label: "Medical history", cats: ["medical_history"] },
            { label: "Allergies", cats: ["allergy"] },
            { label: "Prescriptions", cats: ["prescription"] },
            { label: "Lab reports", cats: ["lab_report"] },
            { label: "Scans", cats: ["scan_report"] },
            { label: "Consultations", cats: ["consultation"] },
          ].map((section) => {
            const rows = bySection(section.cats);
            if (!section.cats.some((c) => categories.includes(c))) return null;
            return (
              <section key={section.label} className="space-y-2">
                <h2 className="text-lg font-semibold">{section.label}</h2>
                {rows.length === 0 && <p className="text-sm text-muted-foreground">No records shared.</p>}
                {rows.map((r: any) => (
                  <article key={r.id} className="card-soft p-4">
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.record_date).toLocaleDateString()}
                      {r.provider ? ` · ${r.provider}` : ""}
                    </p>
                    {r.description && <p className="mt-1 text-sm">{r.description}</p>}
                  </article>
                ))}
              </section>
            );
          })}
        </div>

        <aside className="space-y-5">
          {categories.includes("medicines") && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Current medications</h2>
              {medicines.length === 0 && <p className="text-sm text-muted-foreground">None recorded.</p>}
              {medicines.map((m: any) => (
                <div key={m.id} className="card-soft p-3">
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.dosage} · {m.frequency} · {m.reminder_time}
                  </p>
                </div>
              ))}
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Appointment history</h2>
            {appointments.length === 0 && <p className="text-sm text-muted-foreground">No appointments.</p>}
            {appointments.map((a: any) => (
              <div key={a.id} className="card-soft flex items-center justify-between gap-2 p-3">
                <div>
                  <p className="text-sm">{new Date(a.slot_at).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{a.reason ?? a.mode}</p>
                </div>
                <StatusChip status={a.status} />
              </div>
            ))}
          </section>

          <section className="card-soft space-y-3 p-4">
            <h2 className="text-lg font-semibold">Add clinical record</h2>
            <p className="text-xs text-muted-foreground">
              Only categories covered by consent can be written. Every write is audited.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="cat">Category</Label>
              <select
                id="cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
              >
                {permittedRecordCats.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Clinical note</Label>
              <Textarea id="desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <Button className="w-full rounded-2xl" onClick={save} disabled={saving || permittedRecordCats.length === 0}>
              {saving ? "Saving…" : "Save record"}
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}

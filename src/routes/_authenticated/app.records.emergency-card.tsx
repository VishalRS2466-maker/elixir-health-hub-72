import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, QrCode, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import * as EmergencyService from "@/services/emergency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useSecurity } from "@/components/security/SecurityProvider";

export const Route = createFileRoute("/_authenticated/app/records/emergency-card")({
  head: () => ({
    meta: [
      { title: "Emergency Medical Card · ELIXIR" },
      { name: "description", content: "A limited emergency card with only the information you choose to share." },
      { property: "og:title", content: "Emergency Medical Card · ELIXIR" },
      { property: "og:description", content: "Blood group, allergies and key conditions for emergency responders." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmergencyCardPage,
});

const FIELDS = [
  { key: "name", label: "Name" },
  { key: "universal_id", label: "Universal User ID" },
  { key: "abha_id", label: "ABHA ID" },
  { key: "blood_group", label: "Blood group" },
  { key: "allergies", label: "Allergies" },
  { key: "conditions", label: "Medical conditions" },
  { key: "current_medicines", label: "Current medicines" },
  { key: "emergency_contact", label: "Emergency contact" },
  { key: "notes", label: "Emergency notes" },
];

function EmergencyCardPage() {
  const { user, profile } = useSession();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const card = useQuery({
    queryKey: ["emergency-card", user?.id],
    queryFn: () => EmergencyService.getCard(user!.id),
    enabled: !!user,
  });
  const contacts = useQuery({
    queryKey: ["emergency-contacts", user?.id],
    queryFn: () => EmergencyService.listContacts(user!.id),
    enabled: !!user,
  });

  const data = card.data;
  const visible = data?.visible_fields ?? [];
  const primary = (contacts.data ?? [])[0];
  const { requireAuth } = useSecurity();

  async function toggleField(key: string, on: boolean) {
    if (!user || !data) return;
    const verified = await requireAuth({
      level: "sensitive",
      reason: "Confirm your identity to change what your emergency card reveals.",
    });
    if (!verified) return;
    const next = on ? [...visible, key] : visible.filter((f) => f !== key);
    await EmergencyService.updateCard(user.id, { visible_fields: next });
    await qc.invalidateQueries({ queryKey: ["emergency-card", user.id] });
  }

  const shareText = [
    visible.includes("name") ? `Name: ${profile?.full_name}` : null,
    visible.includes("universal_id") ? `User ID: ${profile?.universal_id}` : null,
    visible.includes("abha_id") && profile?.abha_id ? `ABHA: ${profile.abha_id}` : null,
    visible.includes("blood_group") ? `Blood group: ${data?.blood_group ?? "-"}` : null,
    visible.includes("allergies") ? `Allergies: ${(data?.allergies ?? []).join(", ") || "None"}` : null,
    visible.includes("conditions") ? `Conditions: ${(data?.conditions ?? []).join(", ") || "None"}` : null,
    visible.includes("current_medicines")
      ? `Medicines: ${(data?.current_medicines ?? []).join(", ") || "None"}`
      : null,
    visible.includes("emergency_contact") && primary ? `Contact: ${primary.name} ${primary.phone}` : null,
    visible.includes("notes") && data?.notes ? `Notes: ${data.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-5">
      <Link to="/app/records" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
        <ArrowLeft className="h-4 w-4" /> Medical Records
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Emergency Medical Card</h1>
        <p className="text-sm text-muted-foreground">
          Only the fields you switch on are shown. Your full medical history is never included.
        </p>
      </div>

      {card.isLoading && <p className="text-sm text-muted-foreground">Loading your card…</p>}

      {data && (
        <>
          <article className="card-soft overflow-hidden print:shadow-none">
            <div className="bg-emergency-soft px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide">Emergency Medical Card</p>
              {visible.includes("name") && (
                <p className="font-display text-2xl">{profile?.full_name}</p>
              )}
              {visible.includes("universal_id") && (
                <p className="font-mono text-sm">{profile?.universal_id}</p>
              )}
              {visible.includes("abha_id") && (
                <p className="text-sm text-muted-foreground">
                  ABHA: {profile?.abha_id ?? "Not linked"}
                </p>
              )}
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {visible.includes("blood_group") && (
                <Field label="Blood group" value={data.blood_group ?? "Not set"} />
              )}
              {visible.includes("allergies") && (
                <Field label="Allergies" value={(data.allergies ?? []).join(", ") || "None recorded"} />
              )}
              {visible.includes("conditions") && (
                <Field label="Medical conditions" value={(data.conditions ?? []).join(", ") || "None recorded"} />
              )}
              {visible.includes("current_medicines") && (
                <Field
                  label="Current medicines"
                  value={(data.current_medicines ?? []).join(", ") || "None recorded"}
                />
              )}
              {visible.includes("emergency_contact") && (
                <Field
                  label="Emergency contact"
                  value={primary ? `${primary.name} · ${primary.phone}` : "Not added"}
                />
              )}
              {visible.includes("notes") && <Field label="Notes" value={data.notes ?? "—"} />}
              <div className="sm:col-span-2">
                <div className="flex items-center gap-3 rounded-2xl bg-muted p-4">
                  <QrCode className="h-10 w-10 text-primary" />
                  <p className="text-xs text-muted-foreground">
                    QR sharing (concept): a responder scans a short-lived code that reveals only these
                    fields — never your full records.
                  </p>
                </div>
              </div>
            </div>
          </article>

          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              className="rounded-2xl"
              onClick={async () => {
                if (navigator.share) {
                  await navigator.share({ title: "Emergency medical card", text: shareText }).catch(() => {});
                } else {
                  await navigator.clipboard?.writeText(shareText);
                  toast.success("Card copied to clipboard");
                }
              }}
            >
              <Share2 className="mr-1 h-4 w-4" /> Share card
            </Button>
            <Button variant="outline" className="rounded-2xl" onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" /> Print / download
            </Button>
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={async () => {
                if (editing) {
                  setEditing(false);
                  return;
                }
                const verified = await requireAuth({
                  level: "sensitive",
                  reason:
                    "Verify your identity to edit blood group, allergies, conditions, medicines and emergency contacts.",
                });
                if (verified) setEditing(true);
              }}
            >
              {editing ? "Done editing" : "Edit card"}
            </Button>
          </div>

          <section className="card-soft p-5 print:hidden">
            <h2 className="mb-3 text-lg font-semibold">What is shown on the card</h2>
            <div className="space-y-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{f.label}</span>
                  <Switch
                    checked={visible.includes(f.key)}
                    onCheckedChange={(on) => toggleField(f.key, on)}
                    aria-label={`Show ${f.label}`}
                  />
                </div>
              ))}
            </div>
          </section>

          {editing && <CardEditor requireAuth={requireAuth} card={data} onSaved={() => qc.invalidateQueries({ queryKey: ["emergency-card", user?.id] })} />}
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function CardEditor({
  card,
  onSaved,
  requireAuth,
}: {
  requireAuth: ReturnType<typeof useSecurity>["requireAuth"];
  card: { patient_id: string; blood_group: string | null; allergies: string[]; conditions: string[]; current_medicines: string[]; notes: string | null };
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    blood_group: card.blood_group ?? "",
    allergies: (card.allergies ?? []).join(", "),
    conditions: (card.conditions ?? []).join(", "),
    current_medicines: (card.current_medicines ?? []).join(", "),
    notes: card.notes ?? "",
  });
  const [busy, setBusy] = useState(false);

  const split = (s: string) => s.split(",").map((v) => v.trim()).filter(Boolean);

  return (
    <form
      className="card-soft space-y-3 p-5 print:hidden"
      onSubmit={async (e) => {
        e.preventDefault();
        const verified = await requireAuth({
          level: "sensitive",
          reason: "Confirm with your passkey to save changes to your emergency medical information.",
        });
        if (!verified) return;
        setBusy(true);
        try {
          await EmergencyService.updateCard(card.patient_id, {
            blood_group: form.blood_group,
            allergies: split(form.allergies),
            conditions: split(form.conditions),
            current_medicines: split(form.current_medicines),
            notes: form.notes,
          });
          toast.success("Emergency card updated");
          onSaved();
        } catch {
          toast.error("Could not save the card");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-semibold">Edit card details</h2>
      <div className="space-y-1.5">
        <Label htmlFor="bg">Blood group</Label>
        <Input id="bg" value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="allergies">Allergies (comma separated)</Label>
        <Input id="allergies" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="conditions">Medical conditions</Label>
        <Input id="conditions" value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="meds">Current medicines</Label>
        <Input id="meds" value={form.current_medicines} onChange={(e) => setForm({ ...form, current_medicines: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Emergency notes</Label>
        <Textarea id="notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <Button type="submit" className="rounded-2xl" disabled={busy}>
        {busy ? "Saving…" : "Save card"}
      </Button>
    </form>
  );
}

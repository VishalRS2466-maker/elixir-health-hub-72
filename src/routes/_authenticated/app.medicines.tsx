import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Pill, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import * as ReminderService from "@/services/reminders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, StatusChip } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/app/medicines")({
  head: () => ({
    meta: [
      { title: "Medicines & Reminders · ELIXIR" },
      { name: "description", content: "Track your medicines and get reminders you confirm yourself." },
      { property: "og:title", content: "Medicines & Reminders · ELIXIR" },
      { property: "og:description", content: "Add medicines, set reminder times and log every dose." },
    ],
  }),
  component: MedicinesPage,
});

function MedicinesPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    dosage: "1 tablet",
    frequency: "Once daily",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    reminder_time: "09:00",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const medicines = useQuery({
    queryKey: ["medicines", user?.id],
    queryFn: () => ReminderService.listMedicines(user!.id),
    enabled: !!user,
  });
  const reminders = useQuery({
    queryKey: ["reminders", user?.id],
    queryFn: () => ReminderService.listReminders(user!.id),
    enabled: !!user,
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      setError("Enter the medicine name");
      return;
    }
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await ReminderService.addMedicine({
        patient_id: user.id,
        name: form.name,
        dosage: form.dosage,
        frequency: form.frequency,
        start_date: form.start_date,
        end_date: form.end_date || null,
        reminder_time: form.reminder_time,
        notes: form.notes || null,
      });
      await qc.invalidateQueries({ queryKey: ["medicines", user.id] });
      await qc.invalidateQueries({ queryKey: ["reminders", user.id] });
      toast.success("Medicine and reminder added");
      setAdding(false);
      setForm({ ...form, name: "", notes: "" });
    } catch {
      setError("Could not save the medicine. Please try again.");
      toast.error("Could not save the medicine");
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, status: "taken" | "skipped" | "snoozed") {
    await ReminderService.setReminderStatus(id, status);
    await qc.invalidateQueries({ queryKey: ["reminders", user?.id] });
    toast.success(status === "snoozed" ? "Snoozed for 15 minutes" : `Marked as ${status}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Medicines & Reminders</h1>
          <p className="text-sm text-muted-foreground">
            Reminders only record what you confirm — ELIXIR cannot detect a dose by itself.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={async () => {
              const res = await ReminderService.BrowserNotifications.request();
              if (res === "granted") {
                ReminderService.BrowserNotifications.show("ELIXIR reminders on", "We will alert you at dose time.");
                toast.success("Browser reminders enabled");
              } else if (res === "unsupported") {
                toast.info("This browser does not support notifications");
              } else {
                toast.info("Notifications were not allowed");
              }
            }}
          >
            <Bell className="mr-1 h-4 w-4" /> Enable alerts
          </Button>
          <Button className="rounded-2xl" onClick={() => setAdding((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" /> Add medicine
          </Button>
        </div>
      </div>

      {adding && (
        <form className="card-soft space-y-3 p-5" onSubmit={add}>
          <div className="space-y-1.5">
            <Label htmlFor="name">Medicine name</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Paracetamol 500mg" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dosage">Dosage</Label>
              <Input id="dosage" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frequency">Frequency</Label>
              <Input id="frequency" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start">Start date</Label>
              <Input id="start" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">End date (optional)</Label>
              <Input id="end" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time">Reminder time</Label>
              <Input id="time" type="time" value={form.reminder_time} onChange={(e) => setForm({ ...form, reminder_time: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Take after food" />
          </div>
          {error && <p className="rounded-xl bg-emergency-soft px-3 py-2 text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" className="rounded-2xl" disabled={busy}>
              {busy ? "Saving…" : "Save medicine"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <section className="card-soft p-5">
        <h2 className="mb-3 text-lg font-semibold">Reminders</h2>
        {(reminders.data ?? []).length === 0 ? (
          <EmptyState icon={Bell} title="No medicine reminders" description="Add a medicine to create a reminder." />
        ) : (
          <ul className="space-y-2">
            {(reminders.data ?? []).map((r) => (
              <li key={r.id} className="rounded-2xl border p-3">
                <div className="flex items-center gap-3">
                  <Pill className="h-5 w-5 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.medicines?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.medicines?.dosage} · {new Date(r.scheduled_at).toLocaleString()}
                    </p>
                  </div>
                  <StatusChip status={r.status} />
                </div>
                {r.status === "upcoming" && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Button size="sm" className="rounded-xl" onClick={() => act(r.id, "taken")}>
                      Taken
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => act(r.id, "skipped")}>
                      Skip
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => act(r.id, "snoozed")}>
                      Snooze
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-soft p-5">
        <h2 className="mb-3 text-lg font-semibold">My medicines</h2>
        {(medicines.data ?? []).length === 0 ? (
          <EmptyState icon={Pill} title="No medicines added" description="Add a medicine to start tracking." />
        ) : (
          <ul className="space-y-2">
            {(medicines.data ?? []).map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-2xl border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.dosage} · {m.frequency} · reminder at {m.reminder_time.slice(0, 5)}
                  </p>
                  {m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete medicine"
                  onClick={async () => {
                    if (!confirm(`Remove ${m.name}?`)) return;
                    await ReminderService.deleteMedicine(m.id);
                    await qc.invalidateQueries({ queryKey: ["medicines", user?.id] });
                    await qc.invalidateQueries({ queryKey: ["reminders", user?.id] });
                    toast.success("Medicine removed");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

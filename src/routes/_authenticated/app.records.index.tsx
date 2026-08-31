import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileHeart,
  HeartPulse,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import * as MedicalRecordService from "@/services/records";
import * as AuditService from "@/services/audit";
import { RECORD_CATEGORIES, categoryLabel, type RecordCategory } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/EmptyState";
import { useAi } from "@/components/ai/AiAssistant";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/app/records/")({
  head: () => ({
    meta: [
      { title: "Medical Records · ELIXIR" },
      { name: "description", content: "Your medical timeline: consultations, prescriptions, lab and scan reports." },
      { property: "og:title", content: "Medical Records · ELIXIR" },
      { property: "og:description", content: "A searchable timeline of your health history." },
    ],
  }),
  component: RecordsPage,
});

type MedRecord = Tables<"medical_records">;

function RecordsPage() {
  const { user, profile } = useSession();
  const qc = useQueryClient();
  const ai = useAi();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | RecordCategory>("all");
  const [editing, setEditing] = useState<MedRecord | null>(null);
  const [creating, setCreating] = useState(false);

  const records = useQuery({
    queryKey: ["records", user?.id],
    queryFn: () => MedicalRecordService.listRecords(user!.id),
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    const list = records.data ?? [];
    return list.filter((r) => {
      const matchesCategory = filter === "all" || r.category === filter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.provider ?? "").toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [records.data, filter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, MedRecord[]>();
    for (const r of filtered) {
      const year = new Date(r.record_date).getFullYear().toString();
      map.set(year, [...(map.get(year) ?? []), r]);
    }
    return [...map.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [filtered]);

  async function remove(id: string) {
    if (!confirm("Delete this record? This cannot be undone.")) return;
    await MedicalRecordService.deleteRecord(id);
    if (user)
      await AuditService.log({
        actorId: user.id,
        actorName: profile?.full_name ?? "Patient",
        actorRole: "patient",
        patientId: user.id,
        action: "Deleted medical record",
        resource: "Medical record",
        consentStatus: "self",
      });
    await qc.invalidateQueries({ queryKey: ["records", user?.id] });
    toast.success("Record deleted");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Medical Records</h1>
          <p className="text-sm text-muted-foreground">Your complete health timeline, owned by you.</p>
        </div>
        <Button className="rounded-2xl" onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add record
        </Button>
      </div>

      <Link
        to="/app/records/emergency-card"
        className="card-soft flex items-center gap-3 bg-emergency-soft p-4"
      >
        <HeartPulse className="h-6 w-6 text-emergency" />
        <div className="flex-1">
          <p className="font-semibold">Emergency Medical Card</p>
          <p className="text-xs text-muted-foreground">
            Limited information for emergency responders — you choose what is shown
          </p>
        </div>
      </Link>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search records, doctors or hospitals"
            className="rounded-2xl pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ value: "all", label: "All" }, ...RECORD_CATEGORIES].map((c) => (
            <button
              key={c.value}
              onClick={() => setFilter(c.value as "all" | RecordCategory)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                filter === c.value ? "border-primary bg-brand-soft" : "bg-card"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {records.isLoading && <p className="text-sm text-muted-foreground">Loading your records…</p>}
      {records.isError && (
        <p className="rounded-2xl bg-emergency-soft p-4 text-sm">
          We could not load your records. Please check your connection and retry.
        </p>
      )}

      {!records.isLoading && filtered.length === 0 && (
        <EmptyState
          icon={FileHeart}
          title={search || filter !== "all" ? "No matching records" : "No medical records yet"}
          description={
            search || filter !== "all"
              ? "Try a different search or filter."
              : "Add your first medical record to start your timeline."
          }
          action={
            <Button className="rounded-xl" onClick={() => setCreating(true)}>
              Add record
            </Button>
          }
        />
      )}

      {grouped.map(([year, items]) => (
        <section key={year}>
          <h2 className="mb-2 text-lg font-semibold">{year}</h2>
          <ol className="space-y-3 border-l-2 border-border pl-4">
            {items.map((r) => (
              <li key={r.id} className="relative">
                <span className="absolute -left-[22px] top-4 h-3 w-3 rounded-full bg-primary" />
                <article className="card-soft p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold">
                        {categoryLabel(r.category)}
                      </span>
                      <h3 className="mt-2 text-base font-semibold">{r.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.record_date).toLocaleDateString()} · {r.provider ?? "Self added"}
                        {r.is_demo ? " · sample data" : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edit record" onClick={() => setEditing(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete record" onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {r.description && <p className="mt-2 text-sm">{r.description}</p>}
                  <RecordDetails details={r.details} />
                  {r.file_url && (
                    <a
                      href={r.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-sm font-medium text-primary underline"
                    >
                      Open attached document
                    </a>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-2 rounded-full"
                    onClick={() =>
                      ai.open(
                        { label: r.title, data: JSON.stringify({ ...r, patient_id: undefined }) },
                        r.category === "prescription"
                          ? "Explain this prescription in simple language"
                          : "Explain this report in simple language",
                      )
                    }
                  >
                    <Sparkles className="h-4 w-4" />
                    Ask AI about this {categoryLabel(r.category).toLowerCase()}
                  </Button>
                </article>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {(creating || editing) && (
        <RecordForm
          record={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ["records", user?.id] });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function RecordDetails({ details }: { details: unknown }) {
  if (!details || typeof details !== "object") return null;
  const d = details as {
    results?: { test: string; value: string; range: string }[];
    medicines?: { name: string; dose: string; freq: string }[];
    vitals?: Record<string, string>;
  };
  return (
    <div className="mt-3 space-y-2">
      {d.vitals && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(d.vitals).map(([k, v]) => (
            <span key={k} className="rounded-xl bg-muted px-2.5 py-1 text-xs">
              <strong className="uppercase">{k}</strong> {v}
            </span>
          ))}
        </div>
      )}
      {d.results && (
        <div className="overflow-hidden rounded-xl border">
          {d.results.map((row) => (
            <div key={row.test} className="grid grid-cols-3 gap-2 border-b px-3 py-2 text-xs last:border-0">
              <span className="font-medium">{row.test}</span>
              <span>{row.value}</span>
              <span className="text-muted-foreground">Normal: {row.range}</span>
            </div>
          ))}
        </div>
      )}
      {d.medicines && (
        <ul className="space-y-1">
          {d.medicines.map((m) => (
            <li key={m.name} className="rounded-xl bg-warm-soft px-3 py-2 text-xs">
              <strong>{m.name}</strong> — {m.dose}, {m.freq}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecordForm({
  record,
  onClose,
  onSaved,
}: {
  record: Record | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user, profile } = useSession();
  const [form, setForm] = useState({
    title: record?.title ?? "",
    category: (record?.category ?? "consultation") as RecordCategory,
    record_date: record?.record_date ?? new Date().toISOString().slice(0, 10),
    provider: record?.provider ?? "",
    description: record?.description ?? "",
    file_url: record?.file_url ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.title.trim().length < 3) {
      setError("Give the record a short title (at least 3 characters).");
      return;
    }
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      if (record) {
        await MedicalRecordService.updateRecord(record.id, form);
        toast.success("Record updated");
      } else {
        await MedicalRecordService.createRecord({ ...form, patient_id: user.id });
        toast.success("Record added");
      }
      await AuditService.log({
        actorId: user.id,
        actorName: profile?.full_name ?? "Patient",
        actorRole: "patient",
        patientId: user.id,
        action: record ? "Updated medical record" : "Added medical record",
        resource: form.title,
        consentStatus: "self",
      });
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save the record";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-foreground/30 p-0 md:items-center md:p-6">
      <form
        onSubmit={save}
        className="w-full max-w-lg space-y-4 rounded-t-3xl bg-card p-5 shadow-lift md:rounded-3xl"
      >
        <h2 className="text-lg font-semibold">{record ? "Edit record" : "Add medical record"}</h2>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Blood test at MedLab"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="category">Type</Label>
            <select
              id="category"
              className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as RecordCategory })}
            >
              {RECORD_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={form.record_date}
              onChange={(e) => setForm({ ...form, record_date: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="provider">Doctor / hospital / lab</Label>
          <Input
            id="provider"
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
            placeholder="Dr. Ananya Rao"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Notes</Label>
          <Textarea
            id="description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What was found, advised or prescribed"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="file">Document link (optional)</Label>
          <Input
            id="file"
            value={form.file_url}
            onChange={(e) => setForm({ ...form, file_url: e.target.value })}
            placeholder="https://…"
          />
          <p className="text-xs text-muted-foreground">
            Paste a link to a scanned report. File uploads to secure storage come next.
          </p>
        </div>
        {error && <p className="rounded-xl bg-emergency-soft px-3 py-2 text-sm">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1 rounded-2xl" disabled={busy}>
            {busy ? "Saving…" : "Save record"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

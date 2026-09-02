import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  ScanLine,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import * as MedicalRecordService from "@/services/records";
import * as AuditService from "@/services/audit";
import { scanDocument, type ScanExtraction } from "@/lib/scan.functions";
import { RECORD_CATEGORIES, type RecordCategory } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/records/scan")({
  head: () => ({
    meta: [
      { title: "Scan Prescription or Report · ELIXIR" },
      {
        name: "description",
        content:
          "Photograph a prescription or lab report and let ELIXIR read it, then review and save it to your medical timeline.",
      },
      { property: "og:title", content: "Smart Scan · ELIXIR" },
      { property: "og:description", content: "OCR + AI extraction for prescriptions and medical reports." },
    ],
  }),
  component: ScanPage,
});

type Step = "upload" | "processing" | "review" | "saved";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Scan" },
  { key: "processing", label: "Processing" },
  { key: "review", label: "Review" },
  { key: "saved", label: "Saved" },
];

function ScanPage() {
  const { user, profile } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const runScan = useServerFn(scanDocument);

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ScanExtraction | null>(null);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setDataUrl(null);
    setBlob(null);
    setForm(null);
    setError(null);
    setFileName("");
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please choose a photo of the document (JPG, PNG or HEIC converted to JPG).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("That image is larger than 10 MB. Please use a smaller photo.");
      return;
    }
    setError(null);
    setBlob(file);
    setFileName(file.name);
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read that file"));
      reader.readAsDataURL(file);
    });
    setDataUrl(url);
    setStep("processing");
    try {
      const res = await runScan({ data: { dataUrl: url, fileName: file.name } });
      if (!res.ok) {
        setError(res.error);
        setStep("upload");
        return;
      }
      setForm(res.extraction);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scanning failed. Please try again.");
      setStep("upload");
    }
  }

  async function confirmSave() {
    if (!user || !form) return;
    setSaving(true);
    setError(null);
    try {
      let fileUrl: string | null = null;
      if (blob) {
        const ext = (blob.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
        const path = `${user.id}/${Date.now()}-scan.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("medical-documents")
          .upload(path, blob, { contentType: blob.type, upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("medical-documents")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        fileUrl = signed?.signedUrl ?? null;
      }

      const description = [
        form.summary,
        form.diagnosis.length ? `Diagnosis: ${form.diagnosis.join(", ")}` : "",
        form.observations.length ? `Observations: ${form.observations.join("; ")}` : "",
        form.follow_up ? `Follow-up: ${form.follow_up}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      await MedicalRecordService.createRecord({
        patient_id: user.id,
        category: form.category,
        title: form.title || "Scanned document",
        record_date: form.record_date,
        provider: form.provider || form.doctor_name || null,
        description: description || null,
        file_url: fileUrl,
        details: {
          source: "smart_scan",
          patient_name: form.patient_name,
          doctor_name: form.doctor_name,
          diagnosis: form.diagnosis,
          tests: form.tests,
          observations: form.observations,
          follow_up: form.follow_up,
          ...(form.medicines.length ? { medicines: form.medicines } : {}),
          ...(form.results.length ? { results: form.results } : {}),
        },
      });

      await AuditService.log({
        actorId: user.id,
        actorName: profile?.full_name ?? "Patient",
        actorRole: "patient",
        patientId: user.id,
        action: "Added medical record from Smart Scan",
        resource: form.title,
        consentStatus: "self",
      });

      await qc.invalidateQueries({ queryKey: ["records", user.id] });
      setStep("saved");
      toast.success("Record added to your timeline");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save the record";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const activeIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to="/app/records"
          className="rounded-full border p-2 text-muted-foreground hover:bg-muted"
          aria-label="Back to medical records"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Scan Prescription / Report</h1>
          <p className="text-sm text-muted-foreground">
            Take a photo and ELIXIR reads it for you. Nothing is saved until you confirm.
          </p>
        </div>
      </div>

      {/* Status indicator */}
      <ol className="card-soft flex items-center justify-between gap-2 p-3 text-xs font-semibold">
        {STEPS.map((s, i) => {
          const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
          return (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  state === "todo" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                }`}
              >
                {state === "done" ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </span>
              <span className={state === "todo" ? "text-muted-foreground" : ""}>{s.label}</span>
              {i < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-border sm:block" />}
            </li>
          );
        })}
      </ol>

      {error && (
        <p className="rounded-2xl bg-emergency-soft p-4 text-sm" role="alert">
          {error}
        </p>
      )}

      {step === "upload" && (
        <div className="card-soft space-y-4 p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft">
            <ScanLine className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Upload or capture your document</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Prescriptions, lab reports, scan reports or doctor notes. Keep the page flat and well lit.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button className="rounded-2xl" onClick={() => cameraRef.current?.click()}>
              <Camera className="mr-2 h-4 w-4" /> Take photo
            </Button>
            <Button variant="outline" className="rounded-2xl" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Upload image
            </Button>
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void handleFile(f);
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void handleFile(f);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Your document is stored privately and only you can open it.
          </p>
        </div>
      )}

      {step === "processing" && (
        <div className="card-soft space-y-4 p-8 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Reading your document…</h2>
            <p className="text-sm text-muted-foreground">
              Extracting doctor, date, medicines, tests and results from {fileName || "your image"}.
            </p>
          </div>
          {dataUrl && (
            <img
              src={dataUrl}
              alt="Document being scanned"
              className="mx-auto max-h-56 rounded-2xl border object-contain opacity-70"
            />
          )}
        </div>
      )}

      {step === "review" && form && (
        <ReviewForm
          form={form}
          dataUrl={dataUrl}
          saving={saving}
          onChange={setForm}
          onRetake={reset}
          onConfirm={confirmSave}
        />
      )}

      {step === "saved" && (
        <div className="card-soft space-y-4 p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Saved to your medical timeline</h2>
            <p className="text-sm text-muted-foreground">
              The original document is attached to the record for future reference.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button className="rounded-2xl" onClick={() => navigate({ to: "/app/records" })}>
              View records
            </Button>
            <Button variant="outline" className="rounded-2xl" onClick={reset}>
              Scan another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewForm({
  form,
  dataUrl,
  saving,
  onChange,
  onRetake,
  onConfirm,
}: {
  form: ScanExtraction;
  dataUrl: string | null;
  saving: boolean;
  onChange: (f: ScanExtraction) => void;
  onRetake: () => void;
  onConfirm: () => void;
}) {
  const set = <K extends keyof ScanExtraction>(key: K, value: ScanExtraction[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-brand-soft p-4 text-sm">
        <strong>Check before saving.</strong> ELIXIR read this from your document — correct anything that looks
        wrong. Nothing is added to your records until you confirm.
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="card-soft space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="s-title">Title</Label>
            <Input id="s-title" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-cat">Category</Label>
              <select
                id="s-cat"
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                value={form.category}
                onChange={(e) => set("category", e.target.value as RecordCategory)}
              >
                {RECORD_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-date">Date on document</Label>
              <Input
                id="s-date"
                type="date"
                value={form.record_date}
                onChange={(e) => set("record_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-patient">Patient name</Label>
              <Input
                id="s-patient"
                value={form.patient_name}
                onChange={(e) => set("patient_name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-doctor">Doctor name</Label>
              <Input
                id="s-doctor"
                value={form.doctor_name}
                onChange={(e) => set("doctor_name", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-provider">Hospital / clinic / lab</Label>
            <Input id="s-provider" value={form.provider} onChange={(e) => set("provider", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-summary">Summary</Label>
            <Textarea
              id="s-summary"
              rows={2}
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
            />
          </div>
        </div>

        <div className="card-soft space-y-2 p-4">
          <p className="text-xs font-semibold text-muted-foreground">Scanned document</p>
          {dataUrl ? (
            <img src={dataUrl} alt="Scanned document preview" className="rounded-xl border object-contain" />
          ) : (
            <FileText className="h-8 w-8 text-muted-foreground" />
          )}
          <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={onRetake}>
            Replace document
          </Button>
        </div>
      </div>

      <ListEditor
        title="Diagnosis / conditions"
        placeholder="e.g. Type 2 diabetes"
        items={form.diagnosis}
        onChange={(v) => set("diagnosis", v)}
      />

      <div className="card-soft space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Medicines &amp; dosage</h3>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => set("medicines", [...form.medicines, { name: "", dose: "", freq: "" }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {form.medicines.length === 0 && (
          <p className="text-xs text-muted-foreground">No medicines detected on this document.</p>
        )}
        {form.medicines.map((m, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input
              aria-label="Medicine name"
              placeholder="Name"
              value={m.name}
              onChange={(e) => {
                const next = [...form.medicines];
                next[i] = { ...m, name: e.target.value };
                set("medicines", next);
              }}
            />
            <Input
              aria-label="Dose"
              placeholder="Dose"
              value={m.dose}
              onChange={(e) => {
                const next = [...form.medicines];
                next[i] = { ...m, dose: e.target.value };
                set("medicines", next);
              }}
            />
            <Input
              aria-label="Frequency"
              placeholder="Frequency"
              value={m.freq}
              onChange={(e) => {
                const next = [...form.medicines];
                next[i] = { ...m, freq: e.target.value };
                set("medicines", next);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove medicine"
              onClick={() => set("medicines", form.medicines.filter((_, x) => x !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <ListEditor
        title="Lab / scan tests"
        placeholder="e.g. Complete Blood Count"
        items={form.tests}
        onChange={(v) => set("tests", v)}
      />

      <div className="card-soft space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Test results</h3>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => set("results", [...form.results, { test: "", value: "", range: "" }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {form.results.length === 0 && (
          <p className="text-xs text-muted-foreground">No test values detected on this document.</p>
        )}
        {form.results.map((r, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input
              aria-label="Test"
              placeholder="Test"
              value={r.test}
              onChange={(e) => {
                const next = [...form.results];
                next[i] = { ...r, test: e.target.value };
                set("results", next);
              }}
            />
            <Input
              aria-label="Value"
              placeholder="Value"
              value={r.value}
              onChange={(e) => {
                const next = [...form.results];
                next[i] = { ...r, value: e.target.value };
                set("results", next);
              }}
            />
            <Input
              aria-label="Normal range"
              placeholder="Normal range"
              value={r.range}
              onChange={(e) => {
                const next = [...form.results];
                next[i] = { ...r, range: e.target.value };
                set("results", next);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove result"
              onClick={() => set("results", form.results.filter((_, x) => x !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <ListEditor
        title="Important observations"
        placeholder="e.g. Mild anaemia noted"
        items={form.observations}
        onChange={(v) => set("observations", v)}
      />

      <div className="card-soft space-y-1.5 p-5">
        <Label htmlFor="s-follow">Follow-up recommendation</Label>
        <Textarea
          id="s-follow"
          rows={2}
          value={form.follow_up}
          onChange={(e) => set("follow_up", e.target.value)}
        />
      </div>

      <div className="sticky bottom-4 flex flex-wrap gap-3 rounded-2xl bg-card/95 p-3 shadow-lift backdrop-blur">
        <Button className="flex-1 rounded-2xl" onClick={onConfirm} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Confirm &amp; add to records
        </Button>
        <Button variant="outline" className="rounded-2xl" onClick={onRetake} disabled={saving}>
          Discard
        </Button>
      </div>
    </div>
  );
}

function ListEditor({
  title,
  placeholder,
  items,
  onChange,
}: {
  title: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="card-soft space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => onChange([...items, ""])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {items.length === 0 && <p className="text-xs text-muted-foreground">Nothing detected — you can add your own.</p>}
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input
            aria-label={title}
            placeholder={placeholder}
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove from ${title}`}
            onClick={() => onChange(items.filter((_, x) => x !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

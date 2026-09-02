import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Send, ShieldCheck } from "lucide-react";
import { aiDoctorChat } from "@/lib/ai.functions";
import { doctorPatients } from "@/lib/doctor.functions";
import { categoryLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/doctor/ai")({
  component: DoctorAi,
});

type Msg = { role: "user" | "assistant"; content: string; sources?: string[] };

const PROMPTS = [
  "Summarize this patient's recent medical history",
  "Compare the two latest lab reports",
  "List current medications and possible interactions to check",
  "Summarize the last consultation and follow-up plan",
];

function DoctorAi() {
  const patientsFn = useServerFn(doctorPatients);
  const chat = useServerFn(aiDoctorChat);
  const patients = useQuery({ queryKey: ["doctor-patients"], queryFn: () => patientsFn({}) });
  const [patientId, setPatientId] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const list = patients.data ?? [];
  const selected = list.find((p) => p.patient_id === patientId);

  useEffect(() => {
    if (!patientId && list[0]) setPatientId(list[0].patient_id);
  }, [list, patientId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy || !patientId) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await chat({
        data: { patientId, messages: next.map(({ role, content }) => ({ role, content })) },
      });
      setMessages([...next, { role: "assistant", content: res.reply, sources: res.sources }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "The clinical assistant could not respond. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">AI clinical assistant</h1>
        <p className="text-sm text-muted-foreground">
          Decision support only. It reads exactly what the selected patient consented to — nothing else.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="card-soft space-y-3 p-4">
          <p className="text-sm font-semibold">Authorized patient</p>
          <select
            value={patientId}
            onChange={(e) => {
              setPatientId(e.target.value);
              setMessages([]);
            }}
            className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
          >
            <option value="">Select a patient…</option>
            {list.map((p) => (
              <option key={p.patient_id} value={p.patient_id}>
                {p.full_name} · {p.universal_id}
              </option>
            ))}
          </select>
          {list.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No patient has granted you consent yet. Request access from Patient Requests.
            </p>
          )}
          {selected && (
            <div className="rounded-xl bg-brand-soft p-3 text-xs">
              <p className="flex items-center gap-1 font-medium">
                <ShieldCheck className="h-3.5 w-3.5" /> Consented data
              </p>
              <p className="mt-1">{selected.categories.map(categoryLabel).join(", ")}</p>
            </div>
          )}
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Suggested</p>
            {PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => void send(p)}
                disabled={!patientId}
                className="w-full rounded-xl border bg-background px-3 py-2 text-left text-xs hover:bg-accent disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
        </aside>

        <section className="card-soft flex h-[70vh] flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            <p className="rounded-2xl bg-muted px-4 py-3 text-sm">
              <Bot className="mr-2 inline h-4 w-4" />
              Ask about the selected patient's consented records. Output is informational support and does not
              replace clinical judgement.
            </p>
            {messages.map((m, i) => (
              <div key={i} className="space-y-1">
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm",
                    m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {m.content}
                </div>
                {m.sources && m.sources.length > 0 && (
                  <p className="text-xs text-muted-foreground">Based on: {m.sources.join(" · ")}</p>
                )}
              </div>
            ))}
            {busy && <div className="w-28 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">Thinking…</div>}
            <div ref={endRef} />
          </div>
          <form
            className="flex items-center gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this patient's consented records…"
              className="rounded-full"
              disabled={!patientId}
            />
            <Button type="submit" size="icon" className="rounded-full" disabled={busy || !input.trim() || !patientId}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}

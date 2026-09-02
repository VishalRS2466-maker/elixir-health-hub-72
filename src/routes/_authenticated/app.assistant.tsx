import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, History, Send, Sparkles } from "lucide-react";
import { aiChat, aiRecentMessages } from "@/lib/ai.functions";
import { AI_DISCLAIMER } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/assistant")({
  head: () => ({
    meta: [
      { title: "AI Health Assistant · ELIXIR" },
      { name: "description", content: "Ask about your own reports, prescriptions and medicines in plain language." },
      { property: "og:title", content: "AI Health Assistant · ELIXIR" },
      { property: "og:description", content: "Context-aware answers built from your own ELIXIR health records." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string; sources?: string[] };

const SUGGESTIONS = [
  "Explain my latest report",
  "Explain my prescription",
  "What medicines am I taking?",
  "Summarize my medical history",
  "Explain my appointment",
  "Compare my recent reports",
];

function AssistantPage() {
  const chat = useServerFn(aiChat);
  const recentFn = useServerFn(aiRecentMessages);
  const recent = useQuery({ queryKey: ["ai-recent"], queryFn: () => recentFn({}) });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await chat({
        data: { messages: next.map(({ role, content }) => ({ role, content })), contextLabel: "AI Assistant" },
      });
      setMessages([...next, { role: "assistant", content: res.reply, sources: res.sources }]);
      void recent.refetch();
    } catch {
      setMessages([...next, { role: "assistant", content: "Something went wrong reaching the assistant. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">AI health assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask about your own records — no copy-pasting needed. {AI_DISCLAIMER}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="card-soft flex h-[70vh] flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            <p className="rounded-2xl bg-warm-soft px-4 py-3 text-sm">
              <Bot className="mr-2 inline h-4 w-4" />
              I can read your ELIXIR records, prescriptions, medicines and appointments to answer your questions.
            </p>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    <Sparkles className="mr-1 inline h-3 w-3" />
                    {s}
                  </button>
                ))}
              </div>
            )}
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
              placeholder="Ask about a report, medicine or appointment…"
              className="rounded-full"
            />
            <Button type="submit" size="icon" className="rounded-full" disabled={busy || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </section>

        <aside className="card-soft space-y-2 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4" /> Recent conversations
          </p>
          {(recent.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">Your past questions will appear here.</p>
          )}
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {(recent.data ?? [])
              .slice()
              .reverse()
              .map((m) => (
                <div key={m.id} className="rounded-xl border p-2.5">
                  <p className="text-[10px] uppercase text-muted-foreground">
                    {m.role === "user" ? "You" : "Assistant"} · {new Date(m.created_at).toLocaleString()}
                  </p>
                  <p className="line-clamp-3 text-xs">{m.content}</p>
                  {m.role === "assistant" && m.context_label && (
                    <p className="mt-1 text-[10px] text-muted-foreground">Based on: {m.context_label}</p>
                  )}
                </div>
              ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

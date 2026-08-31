import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { aiChat } from "@/lib/ai.functions";
import { AI_DISCLAIMER } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };
type AiContext = { label: string; data?: string | undefined } | null;

type AiApi = {
  open: (ctx?: AiContext, seedQuestion?: string) => void;
};

const Ctx = createContext<AiApi>({ open: () => {} });
export const useAi = () => useContext(Ctx);

const SUGGESTIONS = [
  "Explain my latest blood report",
  "What does this prescription mean?",
  "How do I book a lab test here?",
  "What is an ABHA ID?",
];

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<AiContext>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const chat = useServerFn(aiChat);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await chat({
        data: {
          messages: next,
          contextLabel: context?.label,
          contextData: context?.data,
        },
      });
      setMessages([...next, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Something went wrong reaching the assistant. Please try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const api: AiApi = {
    open: (ctx, seed) => {
      setContext(ctx ?? null);
      setOpen(true);
      if (seed) void send(seed);
    },
  };

  return (
    <Ctx.Provider value={api}>
      {children}

      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI Healthcare Assistant"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform hover:scale-105 md:bottom-8 md:right-8"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 md:items-center md:p-6">
          <div className="flex h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-card shadow-lift md:h-[80vh] md:rounded-3xl">
            <header className="flex items-center gap-3 border-b bg-brand-soft px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">AI Healthcare Assistant</p>
                <p className="truncate text-xs text-muted-foreground">
                  {context?.label ? `Context: ${context.label}` : "General health guidance"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close assistant">
                <X className="h-5 w-5" />
              </Button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <p className="rounded-2xl bg-warm-soft px-4 py-3 text-sm text-foreground">
                Hi! I can explain reports, prescriptions and medical words in simple language, and help
                you find things in ELIXIR. {AI_DISCLAIMER}
              </p>
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm",
                    m.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {m.content}
                </div>
              ))}
              {busy && (
                <div className="w-24 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                  Thinking…
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form
              className="flex items-center gap-2 border-t bg-card px-3 py-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a report, medicine or the app…"
                className="rounded-full"
              />
              <Button type="submit" size="icon" className="rounded-full" disabled={busy || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function AskAiButton({
  label,
  data,
  question,
  className,
}: {
  label: string;
  data?: string;
  question: string;
  className?: string;
}) {
  const ai = useAi();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-2 rounded-full", className)}
      onClick={() => ai.open({ label, data }, question)}
    >
      <Sparkles className="h-4 w-4" />
      {question}
    </Button>
  );
}

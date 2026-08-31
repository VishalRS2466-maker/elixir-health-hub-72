import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, LifeBuoy, Phone, XCircle } from "lucide-react";
import * as DirectoryService from "@/services/directory";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/app/first-aid")({
  head: () => ({
    meta: [
      { title: "First Aid · ELIXIR" },
      { name: "description", content: "Curated first aid steps for cuts, burns, choking, fever and emergencies." },
      { property: "og:title", content: "First Aid · ELIXIR" },
      { property: "og:description", content: "What to do, what to avoid, and when to seek medical help." },
    ],
  }),
  component: FirstAidPage,
});

function FirstAidPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const articles = useQuery({ queryKey: ["first-aid"], queryFn: DirectoryService.listFirstAid });

  const list = (articles.data ?? []).filter((a) => {
    const q = search.toLowerCase();
    return !q || a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">First Aid</h1>
        <p className="text-sm text-muted-foreground">
          Curated guidance reviewed for the prototype. The AI assistant never invents first aid steps.
        </p>
      </div>

      <div className="card-soft flex items-center gap-3 bg-emergency-soft p-4">
        <AlertTriangle className="h-6 w-6 text-emergency" />
        <div className="flex-1">
          <p className="font-semibold">In a life-threatening emergency</p>
          <p className="text-xs text-muted-foreground">Call emergency services immediately.</p>
        </div>
        <a
          href="tel:112"
          className="inline-flex items-center gap-1 rounded-full bg-emergency px-4 py-2 text-sm font-semibold text-emergency-foreground"
        >
          <Phone className="h-4 w-4" /> 112
        </a>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search: burns, choking, fever…"
        className="rounded-2xl"
      />

      {articles.isLoading && <p className="text-sm text-muted-foreground">Loading topics…</p>}
      {!articles.isLoading && list.length === 0 && (
        <EmptyState icon={LifeBuoy} title="No topic found" description="Try searching for burns or choking." />
      )}

      <div className="space-y-3">
        {list.map((a) => (
          <article key={a.id} className="card-soft overflow-hidden">
            <button
              className="flex w-full items-center gap-3 p-4 text-left"
              onClick={() => setOpen(open === a.id ? null : a.id)}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-primary">
                <LifeBuoy className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{a.title}</span>
                <span className="block text-xs text-muted-foreground">{a.category}</span>
              </span>
              <span className="text-sm text-primary">{open === a.id ? "Hide" : "Open"}</span>
            </button>
            {open === a.id && (
              <div className="space-y-4 border-t px-4 py-4">
                <p className="text-sm">{a.summary}</p>
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-primary" /> What to do
                  </h3>
                  <ol className="space-y-1.5 text-sm">
                    {a.do_steps.map((s, i) => (
                      <li key={s} className="flex gap-2 rounded-xl bg-sage-soft px-3 py-2">
                        <span className="font-semibold">{i + 1}.</span> {s}
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <XCircle className="h-4 w-4 text-emergency" /> What to avoid
                  </h3>
                  <ul className="space-y-1.5 text-sm">
                    {a.avoid_steps.map((s) => (
                      <li key={s} className="rounded-xl bg-emergency-soft px-3 py-2">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl bg-warm-soft px-3 py-3 text-sm">
                  <strong>When to seek medical help:</strong> {a.seek_help}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

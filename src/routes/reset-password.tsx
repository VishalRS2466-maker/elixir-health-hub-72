import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — ELIXIR" },
      { name: "description", content: "Choose a new password for your ELIXIR healthcare account." },
      { property: "og:title", content: "Reset your password — ELIXIR" },
      { property: "og:description", content: "Set a new password for your ELIXIR account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/app", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-soft px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 block text-center font-display text-2xl font-semibold tracking-[0.18em]"
        >
          ELIXIR
        </Link>
        <form className="card-soft space-y-4 p-6" onSubmit={submit}>
          <h1 className="text-2xl font-semibold">Set a new password</h1>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <Button type="submit" className="h-12 w-full rounded-2xl" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}

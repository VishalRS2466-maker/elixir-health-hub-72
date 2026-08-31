import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { HeartPulse, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import * as AuthService from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in to ELIXIR" },
      { name: "description", content: "Sign in or create your ELIXIR health profile as a patient, doctor or admin." },
      { property: "og:title", content: "Sign in to ELIXIR" },
      { property: "og:description", content: "Access your connected health profile on ELIXIR." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Enter your full name").optional(),
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signup");
  const [role, setRole] = useState<AuthService.AppRole>("patient");
  const [form, setForm] = useState({ email: "", password: "", fullName: "", specialty: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = credentials.safeParse({
      email: form.email,
      password: form.password,
      ...(mode === "signup" ? { fullName: form.fullName } : {}),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await AuthService.signUp({
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          role,
          specialty: form.specialty,
        });
        if (res.needsConfirmation) {
          toast.success("Check your email to confirm your account, then sign in.");
          setMode("signin");
          return;
        }
        toast.success("Welcome to ELIXIR");
      } else {
        await AuthService.signIn(form.email, form.password);
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          const roles = await AuthService.getRoles(data.user.id);
          if (roles.length === 0) {
            await AuthService.bootstrapAccount({
              fullName: data.user.user_metadata["full_name"] ?? "Patient",
              email: form.email,
              role: "patient",
            });
          }
        }
        toast.success("Signed in");
      }
      navigate({ to: "/app", replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-soft px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HeartPulse className="h-5 w-5" />
          </span>
          <span className="font-display text-2xl font-semibold">ELIXIR</span>
        </Link>

        <div className="card-soft p-6">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
            {(["signup", "signin"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-xl py-2 text-sm font-semibold ${mode === m ? "bg-card shadow-soft" : "text-muted-foreground"}`}
              >
                {m === "signup" ? "Create account" : "Sign in"}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={submit}>
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Aarav Sharma"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>I am a</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["patient", "doctor", "admin"] as const).map((r) => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setRole(r)}
                        className={`rounded-xl border px-2 py-2 text-sm font-medium capitalize ${role === r ? "border-primary bg-brand-soft" : "bg-background"}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  {role === "admin" && (
                    <p className="text-xs text-muted-foreground">
                      Admin rights are granted by an existing administrator; this account starts with
                      standard access.
                    </p>
                  )}
                </div>
                {role === "doctor" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="specialty">Specialty</Label>
                    <Input
                      id="specialty"
                      value={form.specialty}
                      onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                      placeholder="General Medicine"
                    />
                  </div>
                )}
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="At least 6 characters"
              />
            </div>

            {error && <p className="rounded-xl bg-emergency-soft px-3 py-2 text-sm">{error}</p>}

            <Button type="submit" className="h-12 w-full rounded-2xl" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create my health profile" : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            New patient accounts are pre-filled with realistic sample health data so you can explore
            the full demo immediately.
          </p>
        </div>
      </div>
    </div>
  );
}

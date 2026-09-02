import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import * as AuthService from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your ELIXIR account" },
      {
        name: "description",
        content: "Register for ELIXIR and create a secure healthcare profile in a few simple steps.",
      },
      { property: "og:title", content: "Create your ELIXIR account" },
      { property: "og:description", content: "Register for a secure ELIXIR healthcare profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegisterPage,
});

const schema = z
  .object({
    fullName: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email address"),
    phone: z.string().min(6, "Enter a valid phone number"),
    dob: z.string().min(1, "Enter your date of birth"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

const ROLES = ["patient", "doctor", "admin"] as const;

function RegisterPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<AuthService.AppRole>("patient");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    dob: "",
    password: "",
    confirm: "",
    specialty: "",
  });
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
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setBusy(true);
    try {
      const res = await AuthService.signUp({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone,
        dob: form.dob,
        role,
        specialty: form.specialty,
      });
      if (res.needsConfirmation) {
        toast.success("Check your email to confirm your account, then log in.");
        navigate({ to: "/login" });
        return;
      }
      toast.success("Welcome to ELIXIR");
      const roles = await AuthService.getRoles();
      navigate({
        to: roles.includes("admin") ? "/app/admin" : roles.includes("doctor") ? "/doctor" : "/app",
        replace: true,
      });
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
        <Link
          to="/"
          className="mb-6 block text-center font-display text-2xl font-semibold tracking-[0.18em] text-foreground"
        >
          ELIXIR
        </Link>

        <div className="card-soft p-6">
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A secure healthcare profile takes less than a minute.
          </p>

          <form className="mt-6 space-y-4" onSubmit={submit}>
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="At least 6 characters"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  placeholder="Repeat password"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>I am a</Label>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={`rounded-xl border px-2 py-2 text-sm font-medium capitalize transition-colors ${
                      role === r ? "border-primary bg-brand-soft" : "bg-background"
                    }`}
                  >
                    {r === "patient" ? "User" : r}
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

            {error && <p className="rounded-xl bg-emergency-soft px-3 py-2 text-sm">{error}</p>}

            <Button type="submit" className="h-12 w-full rounded-2xl" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary">
                Login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

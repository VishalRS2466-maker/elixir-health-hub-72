import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import * as AuthService from "@/services/auth";
import { passkeySupported, signInWithPasskey } from "@/lib/passkeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — ELIXIR" },
      {
        name: "description",
        content: "Sign in to ELIXIR to access your connected health profile as a patient, doctor or admin.",
      },
      { property: "og:title", content: "Login — ELIXIR" },
      { property: "og:description", content: "Sign in to your ELIXIR healthcare account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const ROLES = ["patient", "doctor", "admin"] as const;

function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [role, setRole] = useState<AuthService.AppRole>("patient");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeyReady, setPasskeyReady] = useState(false);

  useEffect(() => {
    setPasskeyReady(passkeySupported());
  }, []);

  async function passkeyLogin() {
    setError(null);
    if (!z.string().email().safeParse(form.email).success) {
      setError("Enter your email address, then sign in with your passkey");
      return;
    }
    setBusy(true);
    try {
      await signInWithPasskey(form.email);
      toast.success("Signed in with passkey");
      navigate({ to: "/app", replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Passkey sign-in failed";
      setError(/NotAllowed|abort/i.test(message) ? "Device verification was cancelled." : message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("elixir.email") : null;
    if (saved) setForm((f) => ({ ...f, email: saved }));
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
      await AuthService.signIn(form.email, form.password);
      if (remember) window.localStorage.setItem("elixir.email", form.email);
      else window.localStorage.removeItem("elixir.email");

      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const roles = await AuthService.getRoles(data.user.id);
        if (roles.length === 0) {
          await AuthService.bootstrapAccount({
            fullName: data.user.user_metadata["full_name"] ?? "Patient",
            email: form.email,
            role: "patient",
          });
        } else if (!roles.includes(role)) {
          toast.message(`Signed in with your ${roles[0]} access.`);
        }
      }
      toast.success("Signed in");
      navigate({ to: "/app", replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (!z.string().email().safeParse(form.email).success) {
      toast.error("Enter your email address first");
      return;
    }
    const { error: err } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) toast.error(err.message);
    else toast.success("Password reset link sent to your email");
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
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your healthcare account.</p>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label>Sign in as</Label>
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
                    {r}
                  </button>
                ))}
              </div>
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
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Your password"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-[var(--primary)]"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember me
              </label>
              <button type="button" onClick={forgotPassword} className="font-medium text-primary">
                Forgot password?
              </button>
            </div>

            {error && <p className="rounded-xl bg-emergency-soft px-3 py-2 text-sm">{error}</p>}

            <Button type="submit" className="h-12 w-full rounded-2xl" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>

            {passkeyReady && (
              <>
                <div className="flex items-center gap-3 py-1">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 w-full rounded-2xl"
                  disabled={busy}
                  onClick={passkeyLogin}
                >
                  <Fingerprint className="mr-2 h-5 w-5" />
                  Sign in with Passkey
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Uses your fingerprint, face, Windows Hello or device PIN. ELIXIR never stores
                  biometric data.
                </p>
              </>
            )}

            <Button asChild variant="outline" className="h-12 w-full rounded-2xl">
              <Link to="/register">Create Account</Link>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

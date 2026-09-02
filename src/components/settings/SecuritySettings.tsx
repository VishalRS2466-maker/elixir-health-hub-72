import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Fingerprint,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useSecurity } from "@/components/security/SecurityProvider";
import { guessDeviceName, passkeySupported, registerPasskey } from "@/lib/passkeys";
import { removePasskey, renamePasskey, recordSecurityEvent } from "@/lib/webauthn.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EVENT_LABEL: Record<string, string> = {
  login: "Signed in",
  login_failed: "Failed sign-in",
  passkey_registered: "Passkey added",
  passkey_removed: "Passkey removed",
  reauth_success: "Identity verified",
  reauth_failed: "Failed verification",
  consent_approved: "Consent approved",
  consent_rejected: "Consent rejected",
  consent_revoked: "Consent revoked",
  record_shared: "Records shared",
  emergency_card_updated: "Emergency card updated",
  security_setting_changed: "Security setting changed",
  account_deletion_requested: "Account deletion requested",
};

export function SecuritySettings() {
  const { user } = useSession();
  const qc = useQueryClient();
  const { requireAuth, timeoutMinutes, setTimeoutMinutes, lock } = useSecurity();
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);

  const passkeys = useQuery({
    queryKey: ["passkeys", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("passkey_credentials")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const events = useQuery({
    queryKey: ["security-events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function addPasskey() {
    setBusy(true);
    try {
      await registerPasskey(guessDeviceName());
      toast.success("Passkey added");
      await qc.invalidateQueries({ queryKey: ["passkeys", user?.id] });
      await qc.invalidateQueries({ queryKey: ["security-events", user?.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add a passkey");
    } finally {
      setBusy(false);
    }
  }

  async function doRemove(id: string, nickname: string) {
    const verified = await requireAuth({
      level: "critical",
      reason: `Removing "${nickname}" means this device can no longer unlock your records. Confirm with a passkey.`,
    });
    if (!verified) return;
    try {
      await removePasskey({ data: { id } });
      toast.success("Passkey removed");
      await qc.invalidateQueries({ queryKey: ["passkeys", user?.id] });
      await qc.invalidateQueries({ queryKey: ["security-events", user?.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the passkey");
    }
  }

  async function criticalAccountAction(reason: string, run: () => Promise<void>) {
    const verified = await requireAuth({ level: "critical", reason });
    if (!verified) return;
    await run();
  }

  return (
    <div className="space-y-6">
      {/* Passkeys ---------------------------------------------------- */}
      <section className="card-soft p-5 md:p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">Passkeys</h2>
            <p className="text-sm text-muted-foreground">
              Unlock ELIXIR with your fingerprint, face, Windows Hello or device PIN. Verification
              happens on your device — no biometric data ever reaches our servers.
            </p>
          </div>
          <Button className="shrink-0 rounded-2xl" onClick={addPasskey} disabled={busy || !passkeySupported()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Fingerprint className="mr-2 h-4 w-4" />}
            Add passkey
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {passkeys.isLoading && <p className="text-sm text-muted-foreground">Loading passkeys…</p>}
          {passkeys.data?.length === 0 && (
            <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
              No passkeys yet. Add one to protect your medical records, consent and sharing.
            </p>
          )}
          {(passkeys.data ?? []).map((pk) => (
            <div
              key={pk.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-3"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-primary">
                <KeyRound className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                {renaming?.id === pk.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={renaming.value}
                      autoFocus
                      onChange={(e) => setRenaming({ id: pk.id, value: e.target.value })}
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        await renamePasskey({ data: { id: pk.id, nickname: renaming.value } });
                        setRenaming(null);
                        await qc.invalidateQueries({ queryKey: ["passkeys", user?.id] });
                      }}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="truncate font-medium">{pk.nickname}</p>
                    <p className="text-xs text-muted-foreground">
                      {pk.device_type === "multiDevice" ? "Synced passkey" : "This device only"} ·
                      Last used{" "}
                      {pk.last_used_at ? new Date(pk.last_used_at).toLocaleString() : "never"}
                    </p>
                  </>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Rename passkey"
                  onClick={() => setRenaming({ id: pk.id, value: pk.nickname })}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove passkey"
                  onClick={() => doRemove(pk.id, pk.nickname)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Auto-lock --------------------------------------------------- */}
      <section className="card-soft p-5 md:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Automatic lock</h2>
        <p className="text-sm text-muted-foreground">
          Medical records re-lock after this much inactivity.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[1, 5, 10, 30].map((m) => (
            <button
              key={m}
              onClick={() => setTimeoutMinutes(m)}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${
                timeoutMinutes === m ? "border-primary bg-brand-soft" : "bg-card"
              }`}
            >
              {m} min
            </button>
          ))}
          <Button variant="outline" className="ml-auto rounded-2xl" onClick={lock}>
            Lock now
          </Button>
        </div>
      </section>

      {/* Account security -------------------------------------------- */}
      <section className="card-soft p-5 md:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Account security</h2>
        <p className="text-sm text-muted-foreground">
          These changes always require fresh passkey verification.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="justify-start rounded-2xl"
            onClick={() =>
              criticalAccountAction("Confirm your identity to change your password.", async () => {
                if (!user?.email) return;
                const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) toast.error(error.message);
                else {
                  toast.success("Password reset link sent");
                  await recordSecurityEvent({
                    data: { event: "security_setting_changed", detail: "Password change requested" },
                  });
                }
              })
            }
          >
            <KeyRound className="mr-2 h-4 w-4" /> Change password
          </Button>
          <ChangeEmail onCritical={criticalAccountAction} />
          <Button
            variant="outline"
            className="justify-start rounded-2xl text-emergency sm:col-span-2"
            onClick={() =>
              criticalAccountAction(
                "Account deletion is permanent. Confirm with your passkey to request it.",
                async () => {
                  await recordSecurityEvent({
                    data: { event: "account_deletion_requested", detail: "Requested from settings" },
                  });
                  toast.success("Deletion request recorded. Our privacy team will confirm by email.");
                  await qc.invalidateQueries({ queryKey: ["security-events", user?.id] });
                },
              )
            }
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete account
          </Button>
        </div>
      </section>

      {/* Sessions ----------------------------------------------------- */}
      <section className="card-soft p-5 md:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Active sessions</h2>
        <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-primary">
            <Monitor className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">This device — {guessDeviceName()}</p>
            <p className="text-xs text-muted-foreground">
              Active now · {user?.email}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.assign("/login");
            }}
          >
            Sign out
          </Button>
        </div>
        <Button
          variant="outline"
          className="mt-3 w-full rounded-2xl"
          onClick={async () => {
            await recordSecurityEvent({
              data: { event: "security_setting_changed", detail: "Signed out of all sessions" },
            });
            await supabase.auth.signOut({ scope: "global" });
            window.location.assign("/login");
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out of all devices
        </Button>
      </section>

      {/* Security activity -------------------------------------------- */}
      <section className="card-soft p-5 md:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Activity className="h-5 w-5 text-primary" /> Security activity
        </h2>
        <div className="mt-4 divide-y">
          {(events.data ?? []).length === 0 && (
            <p className="py-3 text-sm text-muted-foreground">No security activity yet.</p>
          )}
          {(events.data ?? []).map((e) => (
            <div key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{EVENT_LABEL[e.event] ?? e.event}</p>
                {e.detail && <p className="truncate text-xs text-muted-foreground">{e.detail}</p>}
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ChangeEmail({
  onCritical,
}: {
  onCritical: (reason: string, run: () => Promise<void>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  if (!open) {
    return (
      <Button variant="outline" className="justify-start rounded-2xl" onClick={() => setOpen(true)}>
        <Mail className="mr-2 h-4 w-4" /> Change email
      </Button>
    );
  }
  return (
    <div className="rounded-2xl border p-3 sm:col-span-2">
      <Label htmlFor="new-email">New email address</Label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input
          id="new-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <Button
          className="rounded-2xl"
          onClick={() =>
            onCritical("Confirm your identity to change the email on your account.", async () => {
              const { error } = await supabase.auth.updateUser({ email });
              if (error) toast.error(error.message);
              else {
                toast.success("Confirmation sent to the new address");
                await recordSecurityEvent({
                  data: { event: "security_setting_changed", detail: "Email change requested" },
                });
                setOpen(false);
              }
            })
          }
        >
          Update
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { Fingerprint, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSecurity } from "@/components/security/SecurityProvider";
import type { SecurityLevel } from "@/lib/passkeys";

/**
 * Blocks rendering (and therefore data fetching) of sensitive children until
 * the person has verified with a passkey / device biometric.
 */
export function SecureGate({
  reason,
  title = "Verify your identity",
  level = "sensitive",
  children,
}: {
  reason: string;
  title?: string;
  level?: SecurityLevel;
  children: ReactNode;
}) {
  const { isUnlocked, requireAuth } = useSecurity();
  const unlocked = isUnlocked(level);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    if (unlocked || asked) return;
    setAsked(true);
    void requireAuth({ reason, level });
  }, [unlocked, asked, requireAuth, reason, level]);

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-lg rounded-3xl border bg-card p-8 text-center shadow-soft">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-brand-soft text-primary">
          <Lock className="h-8 w-8" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
        <Button
          className="mt-6 h-12 rounded-2xl px-6"
          onClick={() => void requireAuth({ reason, level })}
        >
          <Fingerprint className="mr-2 h-5 w-5" /> Unlock with Passkey
        </Button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Verified on your device — no biometric data is
          sent to ELIXIR.
        </p>
      </div>
    </div>
  );
}

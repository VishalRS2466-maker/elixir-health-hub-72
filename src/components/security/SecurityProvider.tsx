import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Fingerprint, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  passkeySupported,
  registerPasskey,
  verifyWithPasskey,
  guessDeviceName,
  type SecurityLevel,
} from "@/lib/passkeys";

/**
 * Reusable re-authentication service.
 *
 * Every sensitive surface (records, consent, sharing, emergency-card editing,
 * security settings) calls `requireAuth({ reason, level })` instead of
 * implementing its own biometric logic. Verification is device-side; the app
 * only ever receives a signed WebAuthn assertion.
 */

type Pending = {
  reason: string;
  level: SecurityLevel;
  resolve: (ok: boolean) => void;
};

type SecurityContextValue = {
  /** Timestamp of the last successful verification, per level. */
  verifiedAt: number | null;
  level: SecurityLevel | null;
  isUnlocked: (level?: SecurityLevel) => boolean;
  requireAuth: (opts: {
    reason: string;
    level?: SecurityLevel;
    onSuccess?: () => void | Promise<void>;
    onCancel?: () => void;
  }) => Promise<boolean>;
  lock: () => void;
  /** Inactivity timeout in minutes for sensitive data. */
  timeoutMinutes: number;
  setTimeoutMinutes: (n: number) => void;
};

const SecurityContext = createContext<SecurityContextValue | null>(null);

const LEVEL_MS: Record<SecurityLevel, number> = {
  normal: 30 * 60_000,
  sensitive: 10 * 60_000,
  critical: 2 * 60_000,
};

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [verifiedAt, setVerifiedAt] = useState<number | null>(null);
  const [level, setLevel] = useState<SecurityLevel | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEnrolment, setNeedsEnrolment] = useState(false);
  const [timeoutMinutes, setTimeoutMinutesState] = useState(() => {
    if (typeof window === "undefined") return 5;
    return Number(window.localStorage.getItem("elixir.lockTimeout") ?? 5);
  });
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTimeoutMinutes = useCallback((n: number) => {
    setTimeoutMinutesState(n);
    window.localStorage.setItem("elixir.lockTimeout", String(n));
  }, []);

  const lock = useCallback(() => {
    setVerifiedAt(null);
    setLevel(null);
  }, []);

  // Auto-lock sensitive data after a configurable period of inactivity.
  useEffect(() => {
    if (!verifiedAt) return;
    const reset = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        lock();
        toast.message("Locked for your security", {
          description: "Sensitive records were locked after inactivity.",
        });
      }, timeoutMinutes * 60_000);
    };
    reset();
    const events = ["pointerdown", "keydown", "scroll", "visibilitychange"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [verifiedAt, timeoutMinutes, lock]);

  const isUnlocked = useCallback(
    (want: SecurityLevel = "sensitive") => {
      if (!verifiedAt || !level) return false;
      if (want === "critical") return level === "critical" && Date.now() - verifiedAt < LEVEL_MS.critical;
      const age = Date.now() - verifiedAt;
      return age < Math.min(LEVEL_MS[want], timeoutMinutes * 60_000);
    },
    [verifiedAt, level, timeoutMinutes],
  );

  const requireAuth = useCallback<SecurityContextValue["requireAuth"]>(
    async ({ reason, level: want = "sensitive", onSuccess, onCancel }) => {
      if (want !== "critical" && isUnlocked(want)) {
        await onSuccess?.();
        return true;
      }
      const ok = await new Promise<boolean>((resolve) => {
        setError(null);
        setNeedsEnrolment(false);
        setPending({ reason, level: want, resolve });
      });
      if (ok) await onSuccess?.();
      else onCancel?.();
      return ok;
    },
    [isUnlocked],
  );

  async function runVerification() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const result = await verifyWithPasskey(pending.level, pending.reason);
      setVerifiedAt(Date.now());
      setLevel(result.level as SecurityLevel);
      pending.resolve(true);
      setPending(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      if (message.includes("NO_PASSKEY")) {
        setNeedsEnrolment(true);
        setError("No passkey is set up on this account yet.");
      } else if (/NotAllowed|abort/i.test(message)) {
        setError("Device verification was cancelled.");
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function enrol() {
    setBusy(true);
    setError(null);
    try {
      await registerPasskey(guessDeviceName());
      setNeedsEnrolment(false);
      toast.success("Passkey added to this device");
      await runVerification();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add a passkey");
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    pending?.resolve(false);
    setPending(null);
  }

  const value = useMemo(
    () => ({
      verifiedAt,
      level,
      isUnlocked,
      requireAuth,
      lock,
      timeoutMinutes,
      setTimeoutMinutes,
    }),
    [verifiedAt, level, isUnlocked, requireAuth, lock, timeoutMinutes, setTimeoutMinutes],
  );

  return (
    <SecurityContext.Provider value={value}>
      {children}
      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Verify your identity"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/45 p-4 backdrop-blur-sm sm:items-center"
        >
          <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-lift">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-primary">
                  <Fingerprint className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">Verify your identity</h2>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {pending.level} action
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" aria-label="Cancel" onClick={cancel}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">{pending.reason}</p>

            <div className="mt-4 rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground">
              Your device checks your fingerprint, face, Windows Hello or PIN. ELIXIR never
              receives or stores biometric data.
            </div>

            {error && (
              <p className="mt-3 rounded-xl bg-emergency-soft px-3 py-2 text-sm">{error}</p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="sm:w-auto" onClick={cancel} disabled={busy}>
                Cancel
              </Button>
              {needsEnrolment ? (
                <Button onClick={enrol} disabled={busy || !passkeySupported()}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Set up passkey
                </Button>
              ) : (
                <Button onClick={runVerification} disabled={busy || !passkeySupported()}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                  Confirm with Passkey
                </Button>
              )}
            </div>
            {!passkeySupported() && (
              <p className="mt-3 text-xs text-muted-foreground">
                This browser does not support passkeys. Open ELIXIR on a device with biometrics or
                a screen lock.
              </p>
            )}
          </div>
        </div>
      )}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error("useSecurity must be used inside SecurityProvider");
  return ctx;
}

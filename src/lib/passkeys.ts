import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";
import {
  startPasskeyRegistration,
  finishPasskeyRegistration,
  startPasskeyLogin,
  finishPasskeyLogin,
  startReauth,
  finishReauth,
} from "@/lib/webauthn.functions";
import { supabase } from "@/integrations/supabase/client";

export type SecurityLevel = "normal" | "sensitive" | "critical";

export function passkeySupported() {
  return typeof window !== "undefined" && browserSupportsWebAuthn();
}

export async function platformAuthenticatorAvailable() {
  if (!passkeySupported()) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

export function guessDeviceName() {
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android device";
  if (/Mac OS X/.test(ua)) return "Mac (Touch ID)";
  if (/Windows/.test(ua)) return "Windows Hello";
  return "This device";
}

/** Registers a new platform passkey (fingerprint / face / Windows Hello / PIN). */
export async function registerPasskey(nickname: string) {
  const options = await startPasskeyRegistration();
  const response = await startRegistration({ optionsJSON: options as never });
  await finishPasskeyRegistration({ data: { response, nickname } });
}

/** Signs in with a passkey and establishes a Supabase session. */
export async function signInWithPasskey(email: string) {
  const options = await startPasskeyLogin({ data: { email } });
  const response = await startAuthentication({ optionsJSON: options as never });
  const { email: verifiedEmail, tokenHash } = await finishPasskeyLogin({ data: { response } });
  const { error } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
    email: verifiedEmail,
  } as never);
  if (error) throw error;
}

/** Re-verifies identity for a sensitive or critical action. */
export async function verifyWithPasskey(level: SecurityLevel, reason: string) {
  const options = await startReauth();
  const response = await startAuthentication({ optionsJSON: options as never });
  return await finishReauth({ data: { response, level, reason } });
}

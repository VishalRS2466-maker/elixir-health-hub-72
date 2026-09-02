import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Passkey / WebAuthn server functions.
 *
 * The device performs fingerprint / face / Windows Hello / PIN verification
 * locally. Only the credential id, public key and counter ever reach the
 * server — no biometric material is transmitted or stored.
 */

export type SecurityLevel = "normal" | "sensitive" | "critical";

const LEVEL_TTL_MS: Record<SecurityLevel, number> = {
  normal: 30 * 60_000,
  sensitive: 10 * 60_000,
  critical: 2 * 60_000,
};

function originAndRpId() {
  const request = getRequest();
  const headerOrigin = request?.headers.get("origin");
  const url = headerOrigin ?? request?.url ?? "http://localhost:8080";
  const parsed = new URL(url);
  return { origin: parsed.origin, rpId: parsed.hostname };
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function logEvent(userId: string | null, event: string, detail?: string) {
  const db = await admin();
  const request = getRequest();
  await db.from("security_events").insert({
    user_id: userId,
    event,
    detail: detail ?? null,
    device: request?.headers.get("user-agent")?.slice(0, 180) ?? null,
  });
}

async function saveChallenge(opts: {
  userId?: string | null;
  email?: string | null;
  challenge: string;
  purpose: string;
}) {
  const db = await admin();
  await db.from("webauthn_challenges").insert({
    user_id: opts.userId ?? null,
    email: opts.email ?? null,
    challenge: opts.challenge,
    purpose: opts.purpose,
  });
}

async function takeChallenge(challenge: string, purpose: string) {
  const db = await admin();
  const { data } = await db
    .from("webauthn_challenges")
    .select("*")
    .eq("challenge", challenge)
    .eq("purpose", purpose)
    .maybeSingle();
  if (!data) return null;
  await db.from("webauthn_challenges").delete().eq("id", data.id);
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

async function findUserByEmail(email: string) {
  const db = await admin();
  const { data } = await db
    .from("profiles")
    .select("id, full_name, email")
    .ilike("email", email)
    .maybeSingle();
  return data;
}

/** Server-side guard: throws unless the user re-authenticated recently. */
export async function assertRecentReauth(userId: string, level: SecurityLevel = "sensitive") {
  const db = await admin();
  const { data } = await db
    .from("reauth_sessions")
    .select("*")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("Re-authentication required");
  if (level === "critical") {
    const fresh = Date.now() - new Date(data.verified_at).getTime() < LEVEL_TTL_MS.critical;
    if (!fresh || data.level !== "critical") throw new Error("Fresh passkey verification required");
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

export const startPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { rpId } = originAndRpId();
    const db = await admin();
    const { data: existing } = await db
      .from("passkey_credentials")
      .select("credential_id, transports")
      .eq("user_id", context.userId);

    const email = (context.claims["email"] as string | undefined) ?? "user";
    const options = await generateRegistrationOptions({
      rpName: "ELIXIR Health",
      rpID: rpId,
      userName: email,
      userDisplayName: email,
      attestationType: "none",
      excludeCredentials: (existing ?? []).map((c) => ({ id: c.credential_id })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
    });
    await saveChallenge({
      userId: context.userId,
      challenge: options.challenge,
      purpose: "register",
    });
    return options;
  });

export const finishPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ response: z.any(), nickname: z.string().min(1).max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { origin, rpId } = originAndRpId();
    const challenge = data.response?.response?.clientDataJSON
      ? JSON.parse(atob(data.response.response.clientDataJSON.replace(/-/g, "+").replace(/_/g, "/")))
          .challenge
      : null;
    if (!challenge) throw new Error("Invalid passkey response");
    const stored = await takeChallenge(challenge, "register");
    if (!stored || stored.user_id !== context.userId) throw new Error("Challenge expired");

    const verification = await verifyRegistrationResponse({
      response: data.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("Passkey registration could not be verified");
    }
    const info = verification.registrationInfo;
    const db = await admin();
    const { error } = await db.from("passkey_credentials").insert({
      user_id: context.userId,
      credential_id: info.credential.id,
      public_key: Buffer.from(info.credential.publicKey).toString("base64url"),
      counter: info.credential.counter,
      transports: info.credential.transports ?? [],
      device_type: info.credentialDeviceType,
      backed_up: info.credentialBackedUp,
      nickname: data.nickname,
      last_used_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await logEvent(context.userId, "passkey_registered", data.nickname);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Passkey sign-in                                                     */
/* ------------------------------------------------------------------ */

export const startPasskeyLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data }) => {
    const { rpId } = originAndRpId();
    const profile = await findUserByEmail(data.email);
    const db = await admin();
    const creds = profile
      ? ((
          await db
            .from("passkey_credentials")
            .select("credential_id, transports")
            .eq("user_id", profile.id)
        ).data ?? [])
      : [];
    if (creds.length === 0) throw new Error("No passkey is registered for this account");

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: "required",
      allowCredentials: creds.map((c) => ({
        id: c.credential_id,
        transports: (c.transports ?? []) as never,
      })),
    });
    await saveChallenge({
      userId: profile!.id,
      email: data.email,
      challenge: options.challenge,
      purpose: "login",
    });
    return options;
  });

async function verifyAssertion(response: any, purpose: string) {
  const { origin, rpId } = originAndRpId();
  const clientData = JSON.parse(
    Buffer.from(response?.response?.clientDataJSON ?? "", "base64url").toString("utf8"),
  );
  const challenge = clientData.challenge as string;
  const stored = await takeChallenge(challenge, purpose);
  if (!stored) throw new Error("Verification challenge expired — please try again");

  const db = await admin();
  const { data: cred } = await db
    .from("passkey_credentials")
    .select("*")
    .eq("credential_id", response.id)
    .maybeSingle();
  if (!cred || cred.user_id !== stored.user_id) throw new Error("Unknown passkey");

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    requireUserVerification: true,
    credential: {
      id: cred.credential_id,
      publicKey: new Uint8Array(Buffer.from(cred.public_key, "base64url")),
      counter: Number(cred.counter),
      transports: (cred.transports ?? []) as never,
    },
  });
  if (!verification.verified) throw new Error("Device verification failed");

  await db
    .from("passkey_credentials")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", cred.id);

  return { userId: cred.user_id as string, nickname: cred.nickname as string };
}

export const finishPasskeyLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ response: z.any() }).parse(d))
  .handler(async ({ data }) => {
    let result: { userId: string; nickname: string };
    try {
      result = await verifyAssertion(data.response, "login");
    } catch (err) {
      await logEvent(null, "login_failed", err instanceof Error ? err.message : "passkey");
      throw err;
    }
    const db = await admin();
    const { data: userRes } = await db.auth.admin.getUserById(result.userId);
    const email = userRes.user?.email;
    if (!email) throw new Error("Account has no email address");

    const { data: link, error } = await db.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error || !link?.properties?.hashed_token) {
      throw new Error(error?.message ?? "Could not start a session");
    }
    await logEvent(result.userId, "login", `Passkey · ${result.nickname}`);
    return { email, tokenHash: link.properties.hashed_token };
  });

/* ------------------------------------------------------------------ */
/* Re-authentication for sensitive / critical actions                  */
/* ------------------------------------------------------------------ */

export const startReauth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { rpId } = originAndRpId();
    const db = await admin();
    const { data: creds } = await db
      .from("passkey_credentials")
      .select("credential_id, transports")
      .eq("user_id", context.userId);
    if (!creds || creds.length === 0) throw new Error("NO_PASSKEY");

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: "required",
      allowCredentials: creds.map((c) => ({
        id: c.credential_id,
        transports: (c.transports ?? []) as never,
      })),
    });
    await saveChallenge({ userId: context.userId, challenge: options.challenge, purpose: "reauth" });
    return options;
  });

export const finishReauth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        response: z.any(),
        level: z.enum(["normal", "sensitive", "critical"]).default("sensitive"),
        reason: z.string().max(160).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let result: { userId: string; nickname: string };
    try {
      result = await verifyAssertion(data.response, "reauth");
    } catch (err) {
      await logEvent(context.userId, "reauth_failed", data.reason ?? null);
      throw err;
    }
    if (result.userId !== context.userId) throw new Error("Passkey does not belong to this account");

    const db = await admin();
    const expires = new Date(Date.now() + LEVEL_TTL_MS[data.level]).toISOString();
    await db.from("reauth_sessions").delete().eq("user_id", context.userId);
    const { data: session, error } = await db
      .from("reauth_sessions")
      .insert({ user_id: context.userId, level: data.level, expires_at: expires })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logEvent(context.userId, "reauth_success", data.reason ?? data.level);
    return { id: session.id, expiresAt: expires, level: data.level };
  });

/* ------------------------------------------------------------------ */
/* Passkey management                                                  */
/* ------------------------------------------------------------------ */

export const renamePasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), nickname: z.string().min(1).max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    await db
      .from("passkey_credentials")
      .update({ nickname: data.nickname })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    await logEvent(context.userId, "security_setting_changed", `Renamed passkey to ${data.nickname}`);
    return { ok: true };
  });

export const removePasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRecentReauth(context.userId, "critical");
    const db = await admin();
    await db
      .from("passkey_credentials")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    await logEvent(context.userId, "passkey_removed", data.id);
    return { ok: true };
  });

/** Records an audited security event for the signed-in user. */
export const recordSecurityEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ event: z.string().max(60), detail: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await logEvent(context.userId, data.event, data.detail);
    return { ok: true };
  });

/** Server-authorised sensitive mutations: verified re-auth is mandatory. */
export const secureConsentDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected", "revoked"]),
        approvedCategories: z.array(z.string()).default([]),
        durationDays: z.number().min(1).max(365).default(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRecentReauth(context.userId, "sensitive");
    const db = await admin();
    const { data: row } = await db
      .from("consent_requests")
      .select("id, patient_id, doctor_name")
      .eq("id", data.id)
      .maybeSingle();
    if (!row || row.patient_id !== context.userId) throw new Error("Not allowed");

    const { error } = await db
      .from("consent_requests")
      .update({
        status: data.status,
        approved_categories: data.status === "approved" ? data.approvedCategories : [],
        expires_at:
          data.status === "approved"
            ? new Date(Date.now() + data.durationDays * 86400000).toISOString()
            : null,
        responded_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logEvent(
      context.userId,
      data.status === "revoked" ? "consent_revoked" : `consent_${data.status}`,
      row.doctor_name ?? undefined,
    );
    return { ok: true };
  });

/** Issues a share token only after verified re-authentication. */
export const createShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        categories: z.array(z.string()).min(1),
        expiresInHours: z.number().min(1).max(720).default(24),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRecentReauth(context.userId, "sensitive");
    const token = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + data.expiresInHours * 3600_000).toISOString();
    await logEvent(
      context.userId,
      "record_shared",
      `${data.categories.join(", ")} · expires ${expiresAt}`,
    );
    return { token, expiresAt, categories: data.categories };
  });

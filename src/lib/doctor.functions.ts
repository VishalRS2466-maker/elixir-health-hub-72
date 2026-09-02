import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Doctor portal server API.
 * Every call: authenticate → verify doctor role → verify active consent for the
 * requested patient + category → retrieve/modify → audit log.
 * RLS (has_consent) enforces the same rules a second time in the database.
 */


export type DoctorRequestRow = {
  id: string;
  patient_id: string;
  patient_name: string;
  status: string;
  reason: string | null;
  requested_categories: string[];
  approved_categories: string[];
  expires_at: string | null;
  created_at: string;
};

export type DoctorAppointmentRow = {
  id: string;
  slot_at: string;
  mode: string;
  reason: string | null;
  status: string;
  patient_id: string;
  patient_name: string;
};

export type DoctorNotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  read: boolean;
  created_at: string;
  link: string | null;
};

export type DoctorOverview = {
  doctor: { id: string; full_name: string; specialty: string; hospital_id: string | null } | null;
  requests: DoctorRequestRow[];
  appointments: DoctorAppointmentRow[];
  notifications: DoctorNotificationRow[];
};

export type DoctorPatientRow = {
  consent_id: string;
  patient_id: string;
  full_name: string;
  universal_id: string;
  gender: string | null;
  blood_group: string | null;
  dob: string | null;
  categories: string[];
  expires_at: string | null;
  reason: string | null;
};

const UUID = /^[0-9a-f-]{36}$/i;

type Ctx = { supabase: any; userId: string };

async function requireDoctor(context: Ctx) {
  const { data: isDoctor } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "doctor",
  });
  if (!isDoctor) throw new Error("Doctor access required");
  const { data: profile } = await context.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", context.userId)
    .maybeSingle();
  return { name: (profile?.full_name as string | undefined) ?? "Doctor" };
}

async function activeConsent(context: Ctx, patientId: string): Promise<string[]> {
  const { data } = await context.supabase
    .from("consent_requests")
    .select("approved_categories, expires_at, created_at")
    .eq("doctor_user_id", context.userId)
    .eq("patient_id", patientId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return [];
  if (data.expires_at && new Date(data.expires_at) <= new Date()) return [];
  return (data.approved_categories as string[]) ?? [];
}

async function audit(
  context: Ctx,
  entry: { name: string; patientId: string; action: string; resource: string; details?: string },
) {
  await context.supabase.from("audit_logs").insert({
    actor_id: context.userId,
    actor_name: entry.name,
    actor_role: "doctor",
    patient_id: entry.patientId,
    action: entry.action,
    resource: entry.resource,
    consent_status: "approved",
    details: entry.details ?? null,
  });
}

export const doctorOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DoctorOverview> => {
    await requireDoctor(context as Ctx);
    const c = context as Ctx;

    const { data: doctor } = await c.supabase
      .from("doctors")
      .select("id, full_name, specialty, hospital_id")
      .eq("user_id", c.userId)
      .maybeSingle();

    const { data: requests } = await c.supabase
      .from("consent_requests")
      .select("*")
      .eq("doctor_user_id", c.userId)
      .order("created_at", { ascending: false });

    let appointments: any[] = [];
    if (doctor?.id) {
      const { data } = await c.supabase
        .from("appointments")
        .select("id, slot_at, mode, reason, status, patient_id")
        .eq("doctor_id", doctor.id)
        .order("slot_at", { ascending: true });
      appointments = data ?? [];
    }

    const patientIds = [
      ...new Set([
        ...(requests ?? []).map((r: any) => r.patient_id),
        ...appointments.map((a) => a.patient_id),
      ]),
    ];
    const names: Record<string, string> = {};
    if (patientIds.length) {
      const { data: profiles } = await c.supabase
        .from("profiles")
        .select("id, full_name, universal_id")
        .in("id", patientIds);
      for (const p of profiles ?? []) names[p.id] = p.full_name;
    }

    const { data: notifications } = await c.supabase
      .from("notifications")
      .select("id, title, body, kind, read, created_at, link")
      .eq("user_id", c.userId)
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      doctor: doctor ?? null,
      requests: (requests ?? []).map((r: any) => ({ ...r, patient_name: names[r.patient_id] ?? "User" })),
      appointments: appointments.map((a) => ({ ...a, patient_name: names[a.patient_id] ?? "User" })),
      notifications: notifications ?? [],
    };
  });

/** Patients whose consent is currently active for this doctor. */
export const doctorPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DoctorPatientRow[]> => {
    await requireDoctor(context as Ctx);
    const c = context as Ctx;
    const { data } = await c.supabase
      .from("consent_requests")
      .select("id, patient_id, approved_categories, expires_at, status, responded_at, reason")
      .eq("doctor_user_id", c.userId)
      .eq("status", "approved")
      .order("responded_at", { ascending: false });

    const live = (data ?? []).filter(
      (r: any) => !r.expires_at || new Date(r.expires_at) > new Date(),
    );
    if (live.length === 0) return [];

    const { data: profiles } = await c.supabase
      .from("profiles")
      .select("id, full_name, universal_id, gender, blood_group, dob")
      .in("id", live.map((r: any) => r.patient_id));

    return live.map((r: any) => {
      const p = (profiles ?? []).find((x: any) => x.id === r.patient_id);
      return {
        consent_id: r.id as string,
        patient_id: r.patient_id as string,
        full_name: (p?.full_name as string) ?? "User",
        universal_id: (p?.universal_id as string) ?? "",
        gender: (p?.gender as string | null) ?? null,
        blood_group: (p?.blood_group as string | null) ?? null,
        dob: (p?.dob as string | null) ?? null,
        categories: (r.approved_categories as string[]) ?? [],
        expires_at: (r.expires_at as string | null) ?? null,
        reason: (r.reason as string | null) ?? null,
      };
    });
  });

/** Full clinical view of ONE consented patient, filtered to consented categories. */
export const doctorPatientView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { patientId: string }) => {
    if (!input || !UUID.test(input.patientId)) throw new Error("A valid patient is required");
    return { patientId: input.patientId };
  })
  .handler(async ({ data, context }) => {
    const c = context as Ctx;
    const { name } = await requireDoctor(c);
    const categories = await activeConsent(c, data.patientId);
    if (categories.length === 0) {
      return { authorized: false as const, categories: [] as string[] };
    }

    const { data: profile } = await c.supabase
      .from("profiles")
      .select("id, full_name, universal_id, gender, dob, blood_group")
      .eq("id", data.patientId)
      .maybeSingle();

    const recordCats = categories.filter((x) => x !== "medicines");
    let records: any[] = [];
    if (recordCats.length) {
      const { data: recs } = await c.supabase
        .from("medical_records")
        .select("id, category, title, description, record_date, provider, details, file_url")
        .eq("patient_id", data.patientId)
        .in("category", recordCats)
        .order("record_date", { ascending: false });
      records = recs ?? [];
    }

    let medicines: any[] = [];
    if (categories.includes("medicines")) {
      const { data: meds } = await c.supabase
        .from("medicines")
        .select("id, name, dosage, frequency, start_date, end_date, reminder_time, notes, active")
        .eq("patient_id", data.patientId)
        .order("reminder_time");
      medicines = meds ?? [];
    }

    const { data: appointments } = await c.supabase
      .from("appointments")
      .select("id, slot_at, mode, reason, status")
      .eq("patient_id", data.patientId)
      .order("slot_at", { ascending: false })
      .limit(20);

    await audit(c, {
      name,
      patientId: data.patientId,
      action: "Opened clinical patient view",
      resource: categories.join(", "),
    });

    return {
      authorized: true as const,
      categories,
      profile: profile ?? null,
      records,
      medicines,
      appointments: appointments ?? [],
    };
  });

/** Add a clinical record (note, prescription, lab report…) for a consented patient. */
export const doctorAddRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      patientId: string;
      category: string;
      title: string;
      description?: string | undefined;
      record_date?: string | undefined;
      file_url?: string | undefined;
    }) => {
      if (!input || !UUID.test(input.patientId)) throw new Error("A valid patient is required");
      const allowed = [
        "consultation",
        "prescription",
        "lab_report",
        "scan_report",
        "medical_history",
        "allergy",
      ];
      if (!allowed.includes(input.category)) throw new Error("Unsupported record category");
      const title = String(input.title ?? "").trim().slice(0, 160);
      if (title.length < 3) throw new Error("A title is required");
      return {
        patientId: input.patientId,
        category: input.category,
        title,
        description: String(input.description ?? "").slice(0, 4000),
        record_date: /^\d{4}-\d{2}-\d{2}$/.test(input.record_date ?? "")
          ? input.record_date!
          : new Date().toISOString().slice(0, 10),
        file_url: input.file_url ? String(input.file_url).slice(0, 2000) : null,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const c = context as Ctx;
    const { name } = await requireDoctor(c);
    const categories = await activeConsent(c, data.patientId);
    if (!categories.includes(data.category)) {
      throw new Error("No active consent for this record category");
    }

    const { error } = await c.supabase.from("medical_records").insert({
      patient_id: data.patientId,
      doctor_user_id: c.userId,
      category: data.category,
      title: data.title,
      description: data.description,
      record_date: data.record_date,
      provider: name,
      file_url: data.file_url,
      details: {},
    });
    if (error) throw new Error(error.message);

    await audit(c, {
      name,
      patientId: data.patientId,
      action: "Added medical record",
      resource: data.category,
      details: data.title,
    });

    await c.supabase.from("notifications").insert({
      user_id: data.patientId,
      title: "New record added by your doctor",
      body: `${name} added "${data.title}" to your records.`,
      kind: "record",
      link: "/app/records",
    });

    return { ok: true as const };
  });

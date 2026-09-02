import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Secure AI context-retrieval layer.
 *
 * Rules:
 * - Every read goes through the CALLER'S authenticated Supabase client, so RLS
 *   (ownership for users, has_consent() for doctors) is the authorization boundary.
 * - Authorization happens BEFORE retrieval. The AI never decides what may be read.
 * - Only the minimum slices needed to answer the question are retrieved, and each
 *   slice is redacted down to non-identifying, clinically relevant fields.
 */

export type Db = SupabaseClient<Database>;

export type Intent = {
  slices: Slice[];
  categories: string[];
  compare: boolean;
  limit: number;
};

export type Slice =
  | "records"
  | "medicines"
  | "appointments"
  | "allergies"
  | "emergency"
  | "profile"
  | "timeline";

export type ContextResult = { text: string; sources: string[] };

const KEYWORDS: { re: RegExp; slices: Slice[]; categories?: string[] }[] = [
  {
    re: /\b(blood|cbc|haemoglobin|hemoglobin|sugar|glucose|cholesterol|lipid|thyroid|tsh|vitamin|lab|test result|report value|pathology)\b/i,
    slices: ["records"],
    categories: ["lab_report"],
  },
  {
    re: /\b(scan|x-?ray|mri|ct|ultrasound|sonography|imaging|radiolog)/i,
    slices: ["records"],
    categories: ["scan_report"],
  },
  {
    re: /\b(prescription|prescribed|prescribe|dosage|tablet|capsule|syrup)\b/i,
    slices: ["records", "medicines"],
    categories: ["prescription"],
  },
  {
    re: /\b(medicine|medication|medicines|meds|drug|pill|dose|reminder)\b/i,
    slices: ["medicines"],
  },
  {
    re: /\b(allerg|reaction|intoleran)/i,
    slices: ["allergies", "emergency"],
    categories: ["allergy"],
  },
  {
    re: /\b(appointment|consult|visit|doctor visit|booking|follow[- ]?up)\b/i,
    slices: ["appointments", "records"],
    categories: ["consultation"],
  },
  {
    re: /\b(history|summar|overview|timeline|past|condition|chronic|overall)\b/i,
    slices: ["timeline", "records", "medicines"],
  },
  {
    re: /\b(emergency|blood group|sos|contact)\b/i,
    slices: ["emergency"],
  },
  {
    re: /\b(report|record|document|result)\b/i,
    slices: ["records"],
  },
];

export function detectIntent(question: string): Intent {
  const slices = new Set<Slice>();
  const categories = new Set<string>();
  for (const k of KEYWORDS) {
    if (k.re.test(question)) {
      k.slices.forEach((s) => slices.add(s));
      k.categories?.forEach((c) => categories.add(c));
    }
  }
  const compare = /\b(compare|comparison|trend|change|better|worse|versus|vs)\b/i.test(question);
  const limit = compare ? 3 : /\b(all|list|history|every)\b/i.test(question) ? 8 : 3;
  return { slices: [...slices], categories: [...categories], compare, limit };
}

function fmtRecord(r: {
  title: string;
  category: string;
  record_date: string;
  provider: string | null;
  description: string | null;
  details: unknown;
}) {
  const lines = [
    `- [${r.category}] ${r.title} (${r.record_date}${r.provider ? `, ${r.provider}` : ""})`,
  ];
  if (r.description) lines.push(`  Notes: ${r.description}`);
  const d = r.details as Record<string, unknown> | null;
  if (d && typeof d === "object") {
    const results = d["results"];
    if (Array.isArray(results) && results.length) {
      lines.push(
        `  Results: ${results
          .slice(0, 25)
          .map((x) => {
            const o = x as Record<string, unknown>;
            return `${String(o["test"] ?? "")}=${String(o["value"] ?? "")}${
              o["range"] ? ` (ref ${String(o["range"])})` : ""
            }`;
          })
          .join("; ")}`,
      );
    }
    const meds = d["medicines"];
    if (Array.isArray(meds) && meds.length) {
      lines.push(
        `  Medicines: ${meds
          .slice(0, 20)
          .map((x) => {
            const o = x as Record<string, unknown>;
            return `${String(o["name"] ?? "")} ${String(o["dose"] ?? "")} ${String(o["freq"] ?? "")}`.trim();
          })
          .join("; ")}`,
      );
    }
    const obs = d["observations"];
    if (Array.isArray(obs) && obs.length) lines.push(`  Observations: ${obs.slice(0, 10).join("; ")}`);
    const diag = d["diagnosis"];
    if (Array.isArray(diag) && diag.length) lines.push(`  Diagnosis: ${diag.slice(0, 10).join("; ")}`);
  }
  return lines.join("\n");
}

/**
 * Retrieve the minimum authorized context for a question.
 * `patientId` must already be authorized for the caller (own id, or a patient
 * whose consent has been verified). RLS enforces this a second time.
 */
export async function buildContext(
  db: Db,
  patientId: string,
  question: string,
  opts: { allowedCategories?: string[] | undefined } = {},
): Promise<ContextResult> {
  const intent = detectIntent(question);
  if (intent.slices.length === 0) return { text: "", sources: [] };

  const allowed = opts.allowedCategories;
  const wantCats = intent.categories.length ? intent.categories : undefined;
  const cats = (wantCats ?? []).filter((c) => !allowed || allowed.includes(c));
  const sources: string[] = [];
  const blocks: string[] = [];

  if (intent.slices.includes("records") || intent.slices.includes("timeline")) {
    let q = db
      .from("medical_records")
      .select("title, category, record_date, provider, description, details")
      .eq("patient_id", patientId)
      .order("record_date", { ascending: false })
      .limit(intent.slices.includes("timeline") ? 10 : intent.limit);
    if (cats.length) q = q.in("category", cats);
    else if (allowed) q = q.in("category", allowed);
    const { data } = await q;
    if (data?.length) {
      blocks.push(`MEDICAL RECORDS (most recent first):\n${data.map(fmtRecord).join("\n")}`);
      const top = data[0]!;
      sources.push(`${top.title} · ${new Date(top.record_date).toLocaleDateString()}`);
      if (data.length > 1) sources.push(`${data.length} records reviewed`);
    }
  }

  if (intent.slices.includes("allergies") && !cats.includes("allergy")) {
    if (!allowed || allowed.includes("allergy")) {
      const { data } = await db
        .from("medical_records")
        .select("title, category, record_date, provider, description, details")
        .eq("patient_id", patientId)
        .eq("category", "allergy")
        .order("record_date", { ascending: false })
        .limit(5);
      if (data?.length) {
        blocks.push(`ALLERGY RECORDS:\n${data.map(fmtRecord).join("\n")}`);
        sources.push("Allergy records");
      }
    }
  }

  if (intent.slices.includes("medicines") && (!allowed || allowed.includes("medicines"))) {
    const { data } = await db
      .from("medicines")
      .select("name, dosage, frequency, start_date, end_date, reminder_time, notes, active")
      .eq("patient_id", patientId)
      .eq("active", true)
      .order("reminder_time");
    if (data?.length) {
      blocks.push(
        `ACTIVE MEDICINES:\n${data
          .map(
            (m) =>
              `- ${m.name} · ${m.dosage} · ${m.frequency} · reminder ${m.reminder_time}${
                m.end_date ? ` · until ${m.end_date}` : ""
              }${m.notes ? ` · ${m.notes}` : ""}`,
          )
          .join("\n")}`,
      );
      sources.push(`${data.length} active medicines`);
    }
  }

  if (intent.slices.includes("appointments")) {
    const { data } = await db
      .from("appointments")
      .select("slot_at, mode, reason, status, doctors(full_name, specialty)")
      .eq("patient_id", patientId)
      .order("slot_at", { ascending: true })
      .limit(5);
    if (data?.length) {
      blocks.push(
        `APPOINTMENTS:\n${data
          .map((a) => {
            const doc = a.doctors as { full_name?: string; specialty?: string } | null;
            return `- ${new Date(a.slot_at).toLocaleString()} · ${a.mode} · ${a.status}${
              doc?.full_name ? ` · ${doc.full_name} (${doc.specialty ?? ""})` : ""
            }${a.reason ? ` · ${a.reason}` : ""}`;
          })
          .join("\n")}`,
      );
      sources.push("Appointment schedule");
    }
  }

  if (intent.slices.includes("emergency") && !allowed) {
    const { data } = await db
      .from("emergency_cards")
      .select("blood_group, allergies, conditions, current_medicines")
      .eq("patient_id", patientId)
      .maybeSingle();
    if (data) {
      blocks.push(
        `EMERGENCY CARD:\n- Blood group: ${data.blood_group ?? "not set"}\n- Allergies: ${
          data.allergies.join(", ") || "none recorded"
        }\n- Conditions: ${data.conditions.join(", ") || "none recorded"}\n- Current medicines: ${
          data.current_medicines.join(", ") || "none recorded"
        }`,
      );
      sources.push("Emergency card");
    }
  }

  return { text: blocks.join("\n\n"), sources };
}

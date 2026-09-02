import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Smart Scan — OCR + AI extraction of prescriptions / lab reports / scan reports.
 * Returns structured data for the user to REVIEW before anything is saved.
 */

export type ScanExtraction = {
  category: string;
  title: string;
  record_date: string;
  patient_name: string;
  doctor_name: string;
  provider: string;
  diagnosis: string[];
  medicines: { name: string; dose: string; freq: string }[];
  tests: string[];
  results: { test: string; value: string; range: string }[];
  observations: string[];
  follow_up: string;
  summary: string;
};

export type ScanDocumentInput = {
  dataUrl: string;
  fileName?: string | undefined;
};

const EXTRACT_PROMPT = `You are a medical document OCR and structuring engine for a user health app.

Read the attached document image (prescription, lab report, scan/diagnostic report or doctor note) and extract the information you can actually SEE. Never invent data. Leave fields empty ("" or []) when the document does not contain them.

Return ONLY a JSON object, no markdown fences, with exactly this shape:
{
  "category": one of "prescription" | "lab_report" | "scan_report" | "consultation" | "medical_history" | "allergy",
  "title": short human title, e.g. "Complete Blood Count — MedLab",
  "record_date": date on the document in YYYY-MM-DD (empty string if not visible),
  "patient_name": string,
  "doctor_name": string,
  "provider": hospital / clinic / lab name,
  "diagnosis": string[] of diagnoses or medical conditions,
  "medicines": [{"name": string, "dose": string, "freq": string}],
  "tests": string[] of lab/scan test names,
  "results": [{"test": string, "value": string with units, "range": reference range or ""}],
  "observations": string[] of important observations / impressions,
  "follow_up": follow-up recommendation text,
  "summary": 1-2 plain-language sentences describing the document
}`;

function coerceString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}
function coerceStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => coerceString(x)).filter(Boolean) : [];
}

function normalise(raw: Record<string, unknown>): ScanExtraction {
  const allowed = [
    "prescription",
    "lab_report",
    "scan_report",
    "consultation",
    "medical_history",
    "allergy",
  ];
  const category = coerceString(raw["category"], "consultation").toLowerCase().replace(/[\s-]+/g, "_");
  const date = coerceString(raw["record_date"]);
  return {
    category: allowed.includes(category) ? category : "consultation",
    title: coerceString(raw["title"], "Scanned document"),
    record_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10),
    patient_name: coerceString(raw["patient_name"]),
    doctor_name: coerceString(raw["doctor_name"]),
    provider: coerceString(raw["provider"]),
    diagnosis: coerceStringArray(raw["diagnosis"]),
    medicines: Array.isArray(raw["medicines"])
      ? (raw["medicines"] as Record<string, unknown>[])
          .map((m) => ({
            name: coerceString(m?.["name"]),
            dose: coerceString(m?.["dose"]),
            freq: coerceString(m?.["freq"]),
          }))
          .filter((m) => m.name)
      : [],
    tests: coerceStringArray(raw["tests"]),
    results: Array.isArray(raw["results"])
      ? (raw["results"] as Record<string, unknown>[])
          .map((r) => ({
            test: coerceString(r?.["test"]),
            value: coerceString(r?.["value"]),
            range: coerceString(r?.["range"]),
          }))
          .filter((r) => r.test)
      : [],
    observations: coerceStringArray(raw["observations"]),
    follow_up: coerceString(raw["follow_up"]),
    summary: coerceString(raw["summary"]),
  };
}

export const scanDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ScanDocumentInput) => {
    const dataUrl = String(input?.dataUrl ?? "");
    if (!dataUrl.startsWith("data:image/")) {
      throw new Error("Please upload an image of the document (JPG or PNG).");
    }
    if (dataUrl.length > 14_000_000) {
      throw new Error("That image is too large. Please use a photo under 10 MB.");
    }
    return { dataUrl, fileName: input.fileName ? String(input.fileName).slice(0, 200) : undefined };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["AI_API_KEY"] ?? process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return {
        ok: false as const,
        error: "Document scanning is not configured yet. You can still add the record manually.",
      };
    }
    const baseUrl = process.env["AI_BASE_URL"] ?? "https://ai.gateway.lovable.dev/v1";
    const model = process.env["AI_SCAN_MODEL"] ?? process.env["AI_MODEL"] ?? "google/gemini-3.5-flash";

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: EXTRACT_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extract the structured JSON from this document${data.fileName ? ` (file: ${data.fileName})` : ""}.`,
                },
                { type: "image_url", image_url: { url: data.dataUrl } },
              ],
            },
          ],
        }),
      });

      if (res.status === 429) {
        return { ok: false as const, error: "Scanning is busy right now. Please try again in a moment." };
      }
      if (res.status === 402 || res.status === 403) {
        return { ok: false as const, error: "Document scanning is unavailable on this workspace right now." };
      }
      if (!res.ok) {
        console.error("Scan gateway error", res.status, await res.text());
        return { ok: false as const, error: "We could not read that document. Try a clearer photo." };
      }

      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        return { ok: false as const, error: "No readable medical information was found in that image." };
      }
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      return { ok: true as const, extraction: normalise(parsed) };
    } catch (err) {
      console.error("Scan failed", err);
      return { ok: false as const, error: "Scanning failed. Please check your connection and try again." };
    }
  });

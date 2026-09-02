import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AIService (server side).
 *
 * Architecture:
 *   Frontend → server fn → auth (requireSupabaseAuth) → role/consent check →
 *   context retrieval (RLS-scoped) → data minimisation → AI provider → reply
 *
 * The AI is read-only: it never writes records, grants consent or changes
 * permissions. Provider keys stay server-side.
 *   AI_BASE_URL, AI_MODEL, LOVABLE_API_KEY (or AI_API_KEY)
 */

export type AiChatInput = {
  messages: { role: "user" | "assistant"; content: string }[];
  contextLabel?: string | undefined;
  contextData?: string | undefined;
};

export type AiDoctorChatInput = AiChatInput & { patientId: string };

const BASE_RULES = `You MUST NOT:
- diagnose any disease or claim certainty
- prescribe medicines or suggest starting, stopping or changing any dose
- invent data that is not present in the provided context
- reveal or speculate about information belonging to any other person

If the situation sounds urgent (chest pain, breathlessness, heavy bleeding, stroke signs, fainting),
tell the user to seek emergency medical care immediately.`;

const PATIENT_PROMPT = `You are the ELIXIR AI Healthcare Assistant, speaking directly to the signed-in user about their own health data.

You HELP by:
- explaining medical terms, lab values, scan reports and prescriptions in plain, calm language
- summarising what a report generally means and comparing recent reports when asked
- explaining the user's active medicines and appointments
- helping them navigate ELIXIR (Medical Records, Emergency Card, E-Hospital, Explore, Consent, Medicine Reminders, First Aid)

${BASE_RULES}

Formatting: use short markdown-style headings, bullet points and highlight important values.
When useful include a "What this means" section and a "What you can ask your doctor" section.
Always end with one line: "This is general information, not medical advice — please confirm with your doctor."`;

const DOCTOR_PROMPT = `You are the ELIXIR AI Clinical Assistant supporting a verified clinician.

You HELP by:
- summarising an authorised user's history and timeline
- summarising and comparing authorised lab/scan reports
- organising clinical information and highlighting notable values or gaps

${BASE_RULES}
You provide decision support only. Never issue autonomous clinical decisions or definitive diagnoses,
and never suggest actions outside the clinician's own judgement.

Formatting: concise clinical bullet points, grouped by heading (History, Medications, Investigations,
Notable findings, Suggested follow-up questions). Note explicitly when consented data is limited.
End with: "Decision support only — clinical judgement remains with the treating clinician."`;

type Msg = { role: "user" | "assistant"; content: string };

function sanitize(input: AiChatInput) {
  if (!input || !Array.isArray(input.messages) || input.messages.length === 0) {
    throw new Error("A message is required");
  }
  return {
    messages: input.messages.slice(-12).map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.content).slice(0, 4000),
    })),
    contextLabel: input.contextLabel ? String(input.contextLabel).slice(0, 120) : undefined,
    contextData: input.contextData ? String(input.contextData).slice(0, 4000) : undefined,
  };
}

async function callModel(system: string, contextBlock: string, messages: Msg[]) {
  const apiKey = process.env["AI_API_KEY"] ?? process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    return {
      ok: false as const,
      reply:
        "The AI assistant is not configured yet. Add an AI provider key to enable it. Everything else in ELIXIR keeps working.",
    };
  }
  const baseUrl = process.env["AI_BASE_URL"] ?? "https://ai.gateway.lovable.dev/v1";
  const model = process.env["AI_MODEL"] ?? "google/gemini-3.5-flash";
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "system", content: contextBlock },
          ...messages,
        ],
      }),
    });
    if (res.status === 429) {
      return { ok: false as const, reply: "The assistant is busy right now. Please try again in a moment." };
    }
    if (res.status === 402) {
      return {
        ok: false as const,
        reply: "The AI workspace is out of credits. Please top up AI credits to continue using the assistant.",
      };
    }
    if (!res.ok) {
      const text = await res.text();
      console.error("AI gateway error", res.status, text);
      return { ok: false as const, reply: "The assistant could not respond right now. Please try again." };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = json.choices?.[0]?.message?.content?.trim();
    return {
      ok: true as const,
      reply: reply || "I could not generate an answer. Please rephrase your question.",
    };
  } catch (err) {
    console.error("AI request failed", err);
    return { ok: false as const, reply: "Network problem while contacting the assistant. Please try again." };
  }
}

/** User assistant — context is retrieved from the caller's OWN data only. */
export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AiChatInput) => sanitize(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const question = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";

    const { buildContext } = await import("./ai-context.server");
    let retrieved = { text: "", sources: [] as string[] };
    try {
      retrieved = await buildContext(supabase, userId, question);
    } catch (err) {
      console.error("context retrieval failed", err);
    }

    const parts = [
      data.contextData
        ? `Context the user selected (${data.contextLabel ?? "app context"}):\n${data.contextData}`
        : `The user is currently on: ${data.contextLabel ?? "the ELIXIR home screen"}.`,
    ];
    if (retrieved.text) {
      parts.push(
        `AUTHORISED DATA FROM THIS USER'S OWN ELIXIR RECORDS (already permission-checked; use it instead of asking the user to paste anything):\n${retrieved.text}`,
      );
    } else {
      parts.push(
        "No stored records matched this question. If the answer needs their records, say what is missing and where to add it in ELIXIR.",
      );
    }

    const result = await callModel(PATIENT_PROMPT, parts.join("\n\n"), data.messages);

    if (result.ok) {
      try {
        await supabase.from("ai_messages").insert([
          { user_id: userId, role: "user", content: question, context_label: data.contextLabel ?? null },
          {
            user_id: userId,
            role: "assistant",
            content: result.reply,
            context_label: retrieved.sources.join(" · ") || null,
          },
        ]);
      } catch (err) {
        console.error("ai_messages persist failed", err);
      }
    }

    return { ...result, sources: retrieved.sources };
  });

/** Clinical assistant — requires the doctor role AND active consent for the user. */
export const aiDoctorChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AiDoctorChatInput) => {
    const base = sanitize(input);
    const patientId = String(input?.patientId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(patientId)) throw new Error("A valid user is required");
    return { ...base, patientId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isDoctor } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "doctor",
    });
    if (!isDoctor) {
      return { ok: false as const, reply: "Clinical assistant is available to verified doctors only.", sources: [] };
    }

    const { data: consent } = await supabase
      .from("consent_requests")
      .select("approved_categories, expires_at, created_at")
      .eq("doctor_user_id", userId)
      .eq("patient_id", data.patientId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const active =
      consent && (!consent.expires_at || new Date(consent.expires_at) > new Date())
        ? consent.approved_categories
        : null;

    if (!active || active.length === 0) {
      return {
        ok: false as const,
        reply: "You do not have active consent for this user. Request access before using the clinical assistant.",
        sources: [],
      };
    }

    const question = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const { buildContext } = await import("./ai-context.server");
    let retrieved = { text: "", sources: [] as string[] };
    try {
      retrieved = await buildContext(supabase, data.patientId, question, { allowedCategories: active });
    } catch (err) {
      console.error("doctor context retrieval failed", err);
    }

    const contextBlock = [
      `Consented data categories for this user: ${active.join(", ")}. Anything outside this list is NOT available.`,
      retrieved.text
        ? `AUTHORISED PATIENT DATA (consent-verified before retrieval):\n${retrieved.text}`
        : "No consented records matched this question. Say so plainly and suggest what category of access may be needed.",
    ].join("\n\n");

    const result = await callModel(DOCTOR_PROMPT, contextBlock, data.messages);

    try {
      await supabase.from("audit_logs").insert({
        actor_id: userId,
        actor_name: "Doctor",
        actor_role: "doctor",
        patient_id: data.patientId,
        action: "AI clinical assistant query",
        resource: active.join(", "),
        consent_status: "approved",
        details: question.slice(0, 300),
      });
    } catch (err) {
      console.error("audit failed", err);
    }

    return { ...result, sources: retrieved.sources };
  });

/** Recent assistant conversation for the signed-in user. */
export const aiRecentMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ai_messages")
      .select("id, role, content, context_label, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(40);
    return (data ?? []).reverse();
  });

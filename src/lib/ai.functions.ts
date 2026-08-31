import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AIService (server side).
 * Provider is configurable through environment variables so the assistant can
 * be pointed at any OpenAI-compatible provider later:
 *   AI_BASE_URL, AI_MODEL, LOVABLE_API_KEY (or AI_API_KEY)
 */

export type AiChatInput = {
  messages: { role: "user" | "assistant"; content: string }[];
  contextLabel?: string;
  contextData?: string;
};

const SYSTEM_PROMPT = `You are the ELIXIR AI Healthcare Assistant inside a patient-centric health app.

You HELP the patient by:
- explaining medical terms, lab values, scan reports and prescriptions in plain, calm language
- summarising what a report generally means and what questions to ask their doctor
- helping them navigate the ELIXIR app (Medical Records, Emergency Card, E-Hospital booking, Explore, Consent, Medicine Reminders, First Aid)
- helping them organise their health information

You MUST NOT:
- diagnose any disease or claim certainty
- prescribe medicines or suggest starting, stopping or changing any dose
- pretend to be a doctor
- invent first aid instructions (point the user to the app's First Aid section instead)
- give emergency instructions beyond "call emergency services / use the SOS button now"

Style: short, friendly, structured with bullet points, no jargon without explanation.
Always end with one line: "This is general information, not medical advice — please confirm with your doctor."`;

export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AiChatInput) => {
    if (!input || !Array.isArray(input.messages) || input.messages.length === 0) {
      throw new Error("A message is required");
    }
    return {
      messages: input.messages.slice(-12).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content).slice(0, 4000),
      })),
      contextLabel: input.contextLabel ? String(input.contextLabel).slice(0, 120) : undefined,
      contextData: input.contextData ? String(input.contextData).slice(0, 4000) : undefined,
    } satisfies AiChatInput;
  })
  .handler(async ({ data }) => {
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

    const contextBlock = data.contextData
      ? `Context the patient selected (${data.contextLabel ?? "app context"}):\n${data.contextData}`
      : `The patient is currently on: ${data.contextLabel ?? "the ELIXIR home screen"}.`;

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "system", content: contextBlock },
            ...data.messages,
          ],
        }),
      });
      if (res.status === 429) {
        return { ok: false as const, reply: "The assistant is busy right now. Please try again in a moment." };
      }
      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error", res.status, text);
        return { ok: false as const, reply: "The assistant could not respond right now. Please try again." };
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const reply = json.choices?.[0]?.message?.content?.trim();
      return { ok: true as const, reply: reply || "I could not generate an answer. Please rephrase your question." };
    } catch (err) {
      console.error("AI request failed", err);
      return { ok: false as const, reply: "Network problem while contacting the assistant. Please try again." };
    }
  });

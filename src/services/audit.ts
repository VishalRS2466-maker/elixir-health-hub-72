import { supabase } from "@/integrations/supabase/client";

export async function log(entry: {
  actorId: string;
  actorName: string;
  actorRole: string;
  patientId?: string | null;
  action: string;
  resource?: string;
  consentStatus?: string | null;
  details?: string;
}) {
  await supabase.from("audit_logs").insert({
    actor_id: entry.actorId,
    actor_name: entry.actorName,
    actor_role: entry.actorRole,
    patient_id: entry.patientId ?? null,
    action: entry.action,
    resource: entry.resource ?? "",
    consent_status: entry.consentStatus ?? null,
    details: entry.details ?? null,
  });
}

export async function listForPatient(patientId: string) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function listAll() {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return data ?? [];
}

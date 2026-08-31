import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export async function listPatientRequests(patientId: string) {
  const { data, error } = await supabase
    .from("consent_requests")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listDoctorRequests(doctorUserId: string) {
  const { data, error } = await supabase
    .from("consent_requests")
    .select("*")
    .eq("doctor_user_id", doctorUserId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function requestAccess(input: TablesInsert<"consent_requests">) {
  const { data, error } = await supabase.from("consent_requests").insert(input).select().single();
  if (error) throw error;
  await supabase.from("notifications").insert({
    user_id: input.patient_id,
    title: "New access request",
    body: `${input.doctor_name ?? "A doctor"} requested access to your medical records.`,
    kind: "consent",
    link: "/app/consent",
  });
  return data;
}

export async function respond(
  id: string,
  status: "approved" | "rejected",
  approvedCategories: string[],
  durationDays: number,
) {
  const { error } = await supabase
    .from("consent_requests")
    .update({
      status,
      approved_categories: status === "approved" ? approvedCategories : [],
      expires_at:
        status === "approved"
          ? new Date(Date.now() + durationDays * 86400000).toISOString()
          : null,
      responded_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function revoke(id: string) {
  const { error } = await supabase
    .from("consent_requests")
    .update({ status: "revoked", approved_categories: [], responded_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

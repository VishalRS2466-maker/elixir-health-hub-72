import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type MedicalRecord = Tables<"medical_records">;

export async function listRecords(patientId: string) {
  const { data, error } = await supabase
    .from("medical_records")
    .select("*")
    .eq("patient_id", patientId)
    .order("record_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getRecord(id: string) {
  const { data, error } = await supabase
    .from("medical_records")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createRecord(input: TablesInsert<"medical_records">) {
  const { data, error } = await supabase
    .from("medical_records")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRecord(id: string, patch: TablesUpdate<"medical_records">) {
  const { error } = await supabase
    .from("medical_records")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRecord(id: string) {
  const { error } = await supabase.from("medical_records").delete().eq("id", id);
  if (error) throw error;
}

import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export async function getCard(patientId: string) {
  const { data, error } = await supabase
    .from("emergency_cards")
    .select("*")
    .eq("patient_id", patientId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertCard(input: TablesInsert<"emergency_cards">) {
  const { error } = await supabase.from("emergency_cards").upsert(input);
  if (error) throw error;
}

export async function updateCard(patientId: string, patch: TablesUpdate<"emergency_cards">) {
  const { error } = await supabase
    .from("emergency_cards")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("patient_id", patientId);
  if (error) throw error;
}

export async function listContacts(patientId: string) {
  const { data, error } = await supabase
    .from("emergency_contacts")
    .select("*")
    .eq("patient_id", patientId)
    .order("is_primary", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addContact(input: TablesInsert<"emergency_contacts">) {
  const { error } = await supabase.from("emergency_contacts").insert(input);
  if (error) throw error;
}

export async function deleteContact(id: string) {
  const { error } = await supabase.from("emergency_contacts").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Emergency location sharing.
 * DEMO: uses the browser Geolocation API and prepares a shareable message.
 * FUTURE: connect a real emergency dispatch / SMS provider here.
 */
export async function currentLocationText(): Promise<string> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return "Location unavailable on this device";
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve(
          `https://www.openstreetmap.org/?mlat=${p.coords.latitude}&mlon=${p.coords.longitude}#map=17/${p.coords.latitude}/${p.coords.longitude}`,
        ),
      () => resolve("Location permission denied"),
      { timeout: 8000 },
    );
  });
}

import { supabase } from "@/integrations/supabase/client";

/**
 * Directory of healthcare providers.
 * DEMO DATA today — swap these reads for a provider registry / maps API later.
 * Distances are pre-computed demo values; LocationService below is the seam
 * where a real geolocation + OpenStreetMap provider plugs in.
 */

export async function listHospitals() {
  const { data, error } = await supabase.from("hospitals").select("*").order("distance_km");
  if (error) throw error;
  return data ?? [];
}

export async function listPharmacies() {
  const { data, error } = await supabase.from("pharmacies").select("*").order("distance_km");
  if (error) throw error;
  return data ?? [];
}

export async function listLaboratories() {
  const { data, error } = await supabase.from("laboratories").select("*").order("distance_km");
  if (error) throw error;
  return data ?? [];
}

export async function listLabServices(kind?: "test" | "scan") {
  let q = supabase.from("lab_services").select("*, laboratories(*)").order("name");
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function listDoctors() {
  const { data, error } = await supabase
    .from("doctors")
    .select("*, hospitals(name, address)")
    .order("rating", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDoctor(id: string) {
  const { data, error } = await supabase
    .from("doctors")
    .select("*, hospitals(name, address, phone)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDoctorByUser(userId: string) {
  const { data, error } = await supabase
    .from("doctors")
    .select("*, hospitals(name)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMedicines(search = "") {
  let q = supabase.from("medicines_catalog").select("*").order("name");
  if (search) q = q.ilike("name", `%${search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function listFirstAid() {
  const { data, error } = await supabase
    .from("first_aid_articles")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

/** LocationService seam. Returns a maps deep-link that works without an API key. */
export const LocationService = {
  directionsUrl(query: { name: string; lat?: number | null; lng?: number | null }) {
    if (query.lat && query.lng) {
      return `https://www.openstreetmap.org/?mlat=${query.lat}&mlon=${query.lng}#map=17/${query.lat}/${query.lng}`;
    }
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query.name)}`;
  },
};

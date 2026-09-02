import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CatalogService = Tables<"catalog_services">;

/**
 * Catalogue of lab tests and scans that can be booked at any nearby facility.
 * Seeded in the database so the booking flow works end to end during demos.
 */
export async function listCatalogServices(kind: "test" | "scan") {
  const { data, error } = await supabase
    .from("catalog_services")
    .select("*")
    .eq("kind", kind)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

/** Services a given facility type can perform. */
export function servicesForFacility(services: CatalogService[], facilityKind: string) {
  return services.filter((s) => (s.facility_kinds ?? []).includes(facilityKind));
}

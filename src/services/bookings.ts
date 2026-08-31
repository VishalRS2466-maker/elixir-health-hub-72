import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export async function listAppointments(patientId: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select("*, doctors(full_name, specialty, fee, hospitals(name))")
    .eq("patient_id", patientId)
    .order("slot_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listDoctorAppointments(doctorId: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select("*, profiles:patient_id(full_name, universal_id)")
    .eq("doctor_id", doctorId)
    .order("slot_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function bookAppointment(input: TablesInsert<"appointments">) {
  const { data, error } = await supabase.from("appointments").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function setAppointmentStatus(id: string, status: string, notes?: string) {
  const { error } = await supabase
    .from("appointments")
    .update({ status, ...(notes ? { notes } : {}) })
    .eq("id", id);
  if (error) throw error;
}

export async function listServiceBookings(patientId: string) {
  const { data, error } = await supabase
    .from("service_bookings")
    .select("*, laboratories(name, address, phone)")
    .eq("patient_id", patientId)
    .order("slot_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function bookService(input: TablesInsert<"service_bookings">) {
  const { data, error } = await supabase.from("service_bookings").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function cancelServiceBooking(id: string) {
  const { error } = await supabase
    .from("service_bookings")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) throw error;
}

/** Demo slot generator — replaced by a provider scheduling API later. */
export function demoSlots(days = 5) {
  const slots: { label: string; iso: string }[] = [];
  const times = [9, 11, 15, 18];
  for (let d = 1; d <= days; d++) {
    for (const t of times) {
      const date = new Date();
      date.setDate(date.getDate() + d);
      date.setHours(t, 0, 0, 0);
      slots.push({
        iso: date.toISOString(),
        label: date.toLocaleString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        }),
      });
    }
  }
  return slots;
}

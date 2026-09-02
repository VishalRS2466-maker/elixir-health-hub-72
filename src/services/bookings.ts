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
    .select("*")
    .eq("doctor_id", doctorId)
    .order("slot_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const patientIds = [...new Set(rows.map((r) => r.patient_id))];
  if (patientIds.length === 0) return rows.map((r) => ({ ...r, patient_name: "Patient" }));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, universal_id")
    .in("id", patientIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    patient_name: byId.get(r.patient_id)?.full_name ?? "Patient",
    patient_universal_id: byId.get(r.patient_id)?.universal_id ?? "",
  }));
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

/* ------------------------------------------------------------------ */
/* Location-based slot availability                                    */
/* ------------------------------------------------------------------ */

export type BookingDay = { iso: string; label: string; isToday: boolean };
export type BookingSlot = { iso: string; label: string };

/** Next `count` bookable days, starting today. */
export function bookingDays(count = 7): BookingDay[] {
  const days: BookingDay[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push({
      iso: d.toISOString(),
      isToday: i === 0,
      label:
        i === 0
          ? "Today"
          : i === 1
            ? "Tomorrow"
            : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
    });
  }
  return days;
}

/**
 * Slots for a given day. Deterministic per facility so a centre keeps the same
 * availability while the user browses. Past slots for today are dropped.
 */
export function slotsForDay(dayIso: string, facilityId: string): BookingSlot[] {
  const day = new Date(dayIso);
  const now = new Date();
  const seed = [...facilityId].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 9973, 7);
  const hours = [8, 9, 10, 11, 12, 15, 16, 17, 18, 19];
  const slots: BookingSlot[] = [];
  hours.forEach((h, index) => {
    // Mark ~1 in 4 slots as taken so availability feels real.
    if ((seed + index * 5 + day.getDate()) % 4 === 0) return;
    const at = new Date(day);
    at.setHours(h, index % 2 === 0 ? 0 : 30, 0, 0);
    if (at.getTime() < now.getTime() + 30 * 60 * 1000) return;
    slots.push({
      iso: at.toISOString(),
      label: at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    });
  });
  return slots;
}

/** True when the facility still has at least one slot left today. */
export function hasSlotsToday(facilityId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return slotsForDay(today.toISOString(), facilityId).length > 0;
}

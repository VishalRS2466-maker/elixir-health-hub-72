import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Medicine = Tables<"medicines">;
export type ReminderLog = Tables<"reminder_logs">;

export async function listMedicines(patientId: string) {
  const { data, error } = await supabase
    .from("medicines")
    .select("*")
    .eq("patient_id", patientId)
    .order("reminder_time");
  if (error) throw error;
  return data ?? [];
}

export async function addMedicine(input: TablesInsert<"medicines">) {
  const { data, error } = await supabase.from("medicines").insert(input).select().single();
  if (error) throw error;
  const scheduled = nextOccurrence(data.reminder_time);
  await supabase.from("reminder_logs").insert({
    medicine_id: data.id,
    patient_id: data.patient_id,
    scheduled_at: scheduled.toISOString(),
    status: "upcoming",
  });
  return data;
}

export async function deleteMedicine(id: string) {
  const { error } = await supabase.from("medicines").delete().eq("id", id);
  if (error) throw error;
}

export async function listReminders(patientId: string) {
  const { data, error } = await supabase
    .from("reminder_logs")
    .select("*, medicines(name, dosage, frequency)")
    .eq("patient_id", patientId)
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function setReminderStatus(id: string, status: "taken" | "skipped" | "snoozed") {
  const patch: { status: string; acted_at: string; scheduled_at?: string } = { status, acted_at: new Date().toISOString() };
  if (status === "snoozed") {
    patch.scheduled_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    patch.status = "upcoming";
  }
  const { error } = await supabase.from("reminder_logs").update(patch).eq("id", id);
  if (error) throw error;
}

/** Create a log row on the fly for a medicine that has none today, then mark it. */
export async function markAdhoc(
  medicineId: string,
  patientId: string,
  scheduledAt: Date,
  status: "taken" | "skipped",
) {
  const { error } = await supabase.from("reminder_logs").insert({
    medicine_id: medicineId,
    patient_id: patientId,
    scheduled_at: scheduledAt.toISOString(),
    status,
    acted_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Today's scheduled time (HH:mm) as a Date for today. */
export function todayAt(time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 9, m ?? 0, 0, 0);
  return d;
}

export function nextOccurrence(time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 9, m ?? 0, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

/** NotificationService (browser) — local notifications only, where supported. */
export const BrowserNotifications = {
  supported: () => typeof window !== "undefined" && "Notification" in window,
  async request() {
    if (!BrowserNotifications.supported()) return "unsupported" as const;
    return await Notification.requestPermission();
  },
  show(title: string, body: string) {
    if (!BrowserNotifications.supported()) return;
    if (Notification.permission === "granted") new Notification(title, { body });
  },
};

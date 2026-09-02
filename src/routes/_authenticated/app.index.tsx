import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Building2,
  CalendarClock,
  ClipboardList,
  Compass,
  FileHeart,
  LifeBuoy,
  Pill,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import * as ReminderService from "@/services/reminders";
import * as BookingService from "@/services/bookings";
import * as MedicalRecordService from "@/services/records";
import * as EmergencyService from "@/services/emergency";
import * as AuditService from "@/services/audit";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusChip } from "@/components/EmptyState";
import { SosDialog } from "@/components/SosDialog";
import { useAi } from "@/components/ai/AiAssistant";
import { categoryLabel } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Home · ELIXIR" },
      { name: "description", content: "Your patient ID, medicine reminders, appointments and records at a glance." },
      { property: "og:title", content: "Home · ELIXIR" },
      { property: "og:description", content: "Your connected health dashboard." },
    ],
  }),
  component: HomePage,
});

const QUICK = [
  { to: "/app/records", label: "Records", icon: FileHeart, tone: "bg-brand-soft" },
  { to: "/app/hospital", label: "E-Hospital", icon: Building2, tone: "bg-sage-soft" },
  { to: "/app/medicines", label: "Medicines", icon: Pill, tone: "bg-warm-soft" },
  { to: "/app/explore", label: "Explore", icon: Compass, tone: "bg-blush-soft" },
  { to: "/app/first-aid", label: "First Aid", icon: LifeBuoy, tone: "bg-emergency-soft" },
  { to: "/app/consent", label: "Consent", icon: ClipboardList, tone: "bg-muted" },
];

function timeUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Due now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `In ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `In ${hours}h ${mins % 60 ? `${mins % 60}m` : ""}`.trim();
  const days = Math.floor(hours / 24);
  return `In ${days}d`;
}

function HomePage() {
  const { user, profile, role } = useSession();
  const ai = useAi();
  const qc = useQueryClient();
  const [sos, setSos] = useState(false);

  const reminders = useQuery({
    queryKey: ["reminders", user?.id],
    queryFn: () => ReminderService.listReminders(user!.id),
    enabled: !!user,
  });
  const appointments = useQuery({
    queryKey: ["appointments", user?.id],
    queryFn: () => BookingService.listAppointments(user!.id),
    enabled: !!user,
  });
  const records = useQuery({
    queryKey: ["records", user?.id],
    queryFn: () => MedicalRecordService.listRecords(user!.id),
    enabled: !!user,
  });
  const contacts = useQuery({
    queryKey: ["emergency-contacts", user?.id],
    queryFn: () => EmergencyService.listContacts(user!.id),
    enabled: !!user,
  });

  const nextReminder = (reminders.data ?? []).find((r) => r.status === "upcoming");
  const upcomingAppointments = (appointments.data ?? [])
    .filter((a) => new Date(a.slot_at) > new Date() && a.status !== "cancelled")
    .slice(0, 2);
  const recentRecords = (records.data ?? []).slice(0, 5);

  async function logSos(action: string) {
    if (!user) return;
    await AuditService.log({
      actorId: user.id,
      actorName: profile?.full_name ?? "Patient",
      actorRole: "patient",
      patientId: user.id,
      action,
      resource: "Emergency",
      consentStatus: "self",
    });
  }

  async function act(id: string, status: "taken" | "skipped" | "snoozed") {
    await ReminderService.setReminderStatus(id, status);
    await qc.invalidateQueries({ queryKey: ["reminders", user?.id] });
    toast.success(
      status === "taken" ? "Marked as taken" : status === "skipped" ? "Marked as skipped" : "Snoozed for 15 minutes",
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      {/* Header: greeting, ID, compact SOS */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hello, {profile?.full_name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Patient ID:{" "}
            <Link to="/app/profile" className="font-mono font-medium text-foreground hover:underline">
              {profile?.universal_id ?? "—"}
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">
            ABHA: {profile?.abha_id ? profile.abha_id : "Not linked yet"}
          </p>
        </div>
        <button
          onClick={() => setSos(true)}
          className="flex shrink-0 items-center gap-2 rounded-full bg-emergency-soft px-4 py-2.5 text-sm font-semibold text-emergency shadow-sm transition-colors hover:opacity-80"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-emergency" />
          SOS Emergency
        </button>
      </div>

      {role !== "patient" && (
        <Link
          to={role === "doctor" ? "/app/doctor" : "/app/admin"}
          className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent"
        >
          <Stethoscope className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">Go to your {role} dashboard</p>
            <p className="text-xs text-muted-foreground">Appointments, requests and management tools</p>
          </div>
        </Link>
      )}

      {/* Quick access: light icon tiles */}
      <section className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        {QUICK.map((q) => (
          <Link key={q.to} to={q.to} className="group flex flex-col items-center gap-2">
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-transparent ${q.tone} text-primary transition-colors group-hover:border-primary/20 group-hover:bg-primary/10`}
            >
              <q.icon className="h-6 w-6" />
            </span>
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">{q.label}</span>
          </Link>
        ))}
      </section>

      {/* Main content: packed two-column grid on wide screens */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
      {/* Next medicine: primary focus */}
      <section className="rounded-3xl border bg-card p-6 shadow-sm">
        {nextReminder ? (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Pill className="h-6 w-6 text-primary" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Next medicine</p>
                  <h2 className="text-lg font-bold">{nextReminder.medicines?.name}</h2>
                  <p className="text-xs text-muted-foreground">{nextReminder.medicines?.dosage}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">
                  {new Date(nextReminder.scheduled_at).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                <p className="text-xs text-muted-foreground">{timeUntil(nextReminder.scheduled_at)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Button className="rounded-2xl py-3 shadow-md active:scale-95" onClick={() => act(nextReminder.id, "taken")}>
                Taken
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl border-transparent bg-muted py-3 hover:bg-accent"
                onClick={() => act(nextReminder.id, "skipped")}
              >
                Skip
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl border-transparent bg-muted py-3 hover:bg-accent"
                onClick={() => act(nextReminder.id, "snoozed")}
              >
                Snooze
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              ELIXIR only records what you confirm here — it cannot detect whether a medicine was taken.
            </p>
          </>
        ) : (
          <EmptyState
            icon={Pill}
            title="No medicine reminders"
            description="Add a medicine to create a reminder."
            action={
              <Button asChild className="rounded-xl">
                <Link to="/app/medicines">Add medicine</Link>
              </Button>
            }
          />
        )}
      </section>
        </div>

      {/* Secondary info: appointment + records stacked */}
      <div className="space-y-5 lg:col-span-2">
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold">Upcoming</h3>
            <Link to="/app/hospital" className="text-xs font-semibold text-primary">
              Book
            </Link>
          </div>
          {upcomingAppointments.length > 0 ? (
            <ul className="space-y-3">
              {upcomingAppointments.map((a) => (
                <li key={a.id} className="flex items-center gap-4">
                  <div className="min-w-[3.5rem] rounded-xl bg-sage-soft p-2 text-center">
                    <span className="block text-[10px] font-bold uppercase text-primary">
                      {new Date(a.slot_at).toLocaleString(undefined, { month: "short" })}
                    </span>
                    <span className="block text-lg font-bold leading-tight">
                      {new Date(a.slot_at).getDate()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.doctors?.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.doctors?.specialty} ·{" "}
                      {new Date(a.slot_at).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <StatusChip status={a.status} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground">
              <CalendarClock className="h-5 w-5" />
              <p className="text-xs">No upcoming appointments — book a doctor to see it here.</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold">Recent records</h3>
            <Link to="/app/records" className="text-xs font-semibold text-primary">
              View all
            </Link>
          </div>
          {recentRecords.length > 0 ? (
            <ul className="space-y-3">
              {recentRecords.map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft">
                    <FileHeart className="h-4 w-4 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {categoryLabel(r.category)} · {new Date(r.record_date).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground">
              <FileHeart className="h-5 w-5" />
              <p className="text-xs">No records yet — add your first medical record.</p>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* AI assistant entry */}
      <button
        onClick={() => ai.open({ label: "ELIXIR home screen" }, "What can you help me with here?")}
        className="group relative flex w-full items-center justify-between overflow-hidden rounded-3xl bg-foreground p-5 text-left shadow-lg transition-shadow hover:shadow-xl"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent" />
        <div className="relative z-10 flex items-center gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/10 backdrop-blur-md">
            <Sparkles className="h-5 w-5 text-background" />
          </span>
          <span>
            <span className="block text-sm font-bold text-background">Ask ELIXIR AI</span>
            <span className="block text-xs text-background/60">
              Ask about a report, prescription or how to use ELIXIR
            </span>
          </span>
        </div>
        <span className="relative z-10 flex items-center gap-1.5 rounded-full border border-background/20 bg-background/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tighter text-background transition-colors group-hover:bg-background/20">
          <Bot className="h-3 w-3" /> Tap to talk
        </span>
      </button>

      <SosDialog
        open={sos}
        onClose={() => setSos(false)}
        contacts={contacts.data ?? []}
        onLogged={(action) => void logSos(action)}
      />
    </div>
  );
}

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
  IdCard,
  LifeBuoy,
  Pill,
  Siren,
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
  { to: "/app/records", label: "Medical Records", icon: FileHeart, tone: "bg-brand-soft" },
  { to: "/app/hospital", label: "E-Hospital", icon: Building2, tone: "bg-sage-soft" },
  { to: "/app/medicines", label: "Medicines", icon: Pill, tone: "bg-warm-soft" },
  { to: "/app/explore", label: "Explore", icon: Compass, tone: "bg-blush-soft" },
  { to: "/app/first-aid", label: "First Aid", icon: LifeBuoy, tone: "bg-emergency-soft" },
  { to: "/app/consent", label: "Consent", icon: ClipboardList, tone: "bg-muted" },
];

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
  const nextAppointment = (appointments.data ?? []).find(
    (a) => new Date(a.slot_at) > new Date() && a.status !== "cancelled",
  );
  const recentRecords = (records.data ?? []).slice(0, 3);

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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">
          Hello, {profile?.full_name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="text-sm text-muted-foreground">Here is your health at a glance.</p>
      </div>

      {role !== "patient" && (
        <Link
          to={role === "doctor" ? "/app/doctor" : "/app/admin"}
          className="card-soft flex items-center gap-3 p-4"
        >
          <Stethoscope className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">Go to your {role} dashboard</p>
            <p className="text-xs text-muted-foreground">Appointments, requests and management tools</p>
          </div>
        </Link>
      )}

      {/* Universal Patient ID */}
      <section className="card-soft overflow-hidden">
        <div className="bg-brand-soft p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <IdCard className="h-4 w-4" /> Universal Patient ID
              </p>
              <p className="mt-1 font-display text-xl">{profile?.full_name}</p>
              <p className="font-mono text-lg">{profile?.universal_id}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                ABHA ID: {profile?.abha_id ? profile.abha_id : "Not linked yet"}
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/app/profile">View profile</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* SOS */}
      <button
        onClick={() => setSos(true)}
        className="flex w-full items-center gap-4 rounded-3xl bg-emergency px-5 py-5 text-left text-emergency-foreground shadow-lift transition-transform hover:scale-[1.01]"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emergency-foreground/20">
          <Siren className="h-7 w-7" />
        </span>
        <span>
          <span className="block text-xl font-semibold">Emergency SOS</span>
          <span className="block text-sm opacity-90">Get emergency assistance</span>
        </span>
      </button>

      {/* Medicine reminder */}
      <section className="card-soft p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Next medicine</h2>
          <Link to="/app/medicines" className="text-sm font-medium text-primary">
            All medicines
          </Link>
        </div>
        {nextReminder ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-warm-soft p-4">
              <Pill className="h-6 w-6 text-primary" />
              <div className="flex-1">
                <p className="font-semibold">{nextReminder.medicines?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {nextReminder.medicines?.dosage} ·{" "}
                  {new Date(nextReminder.scheduled_at).toLocaleString(undefined, {
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <StatusChip status={nextReminder.status} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button className="rounded-xl" onClick={() => act(nextReminder.id, "taken")}>
                Taken
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => act(nextReminder.id, "skipped")}>
                Skip
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => act(nextReminder.id, "snoozed")}>
                Snooze
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              ELIXIR only records what you confirm here — it cannot detect whether a medicine was taken.
            </p>
          </div>
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

      {/* Quick actions */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Quick access</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {QUICK.map((q) => (
            <Link key={q.to} to={q.to} className="card-soft flex flex-col items-center gap-2 p-3 text-center">
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${q.tone} text-primary`}>
                <q.icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium leading-tight">{q.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming appointment */}
      <section className="card-soft p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upcoming appointment</h2>
          <Link to="/app/hospital" className="text-sm font-medium text-primary">
            Book
          </Link>
        </div>
        {nextAppointment ? (
          <div className="flex items-center gap-3 rounded-2xl bg-sage-soft p-4">
            <CalendarClock className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <p className="font-semibold">
                {nextAppointment.doctors?.full_name} · {nextAppointment.doctors?.specialty}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(nextAppointment.slot_at).toLocaleString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <StatusChip status={nextAppointment.status} />
          </div>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="No upcoming appointments"
            description="Book a doctor to see your appointments here."
            action={
              <Button asChild className="rounded-xl">
                <Link to="/app/hospital">Book a doctor</Link>
              </Button>
            }
          />
        )}
      </section>

      {/* Recent records */}
      <section className="card-soft p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent medical records</h2>
          <Link to="/app/records" className="text-sm font-medium text-primary">
            View all
          </Link>
        </div>
        {recentRecords.length > 0 ? (
          <ul className="space-y-2">
            {recentRecords.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border p-3">
                <FileHeart className="h-5 w-5 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {categoryLabel(r.category)} · {new Date(r.record_date).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={FileHeart}
            title="No medical records yet"
            description="Add your first medical record."
            action={
              <Button asChild className="rounded-xl">
                <Link to="/app/records">Add record</Link>
              </Button>
            }
          />
        )}
      </section>

      <button
        onClick={() => ai.open({ label: "ELIXIR home screen" }, "What can you help me with here?")}
        className="card-soft flex w-full items-center gap-3 p-4 text-left"
      >
        <Bot className="h-6 w-6 text-primary" />
        <div>
          <p className="font-semibold">AI Healthcare Assistant</p>
          <p className="text-xs text-muted-foreground">
            Ask about a report, prescription or how to use ELIXIR
          </p>
        </div>
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

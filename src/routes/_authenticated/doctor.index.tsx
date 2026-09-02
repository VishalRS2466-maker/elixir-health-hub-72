import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CalendarDays, FileHeart, Users } from "lucide-react";
import { doctorOverview, doctorPatients } from "@/lib/doctor.functions";
import { categoryLabel } from "@/lib/constants";
import { EmptyState, StatusChip } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/doctor/")({
  component: DoctorDashboard,
});

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="card-soft flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function DoctorDashboard() {
  const overviewFn = useServerFn(doctorOverview);
  const patientsFn = useServerFn(doctorPatients);
  const overview = useQuery({ queryKey: ["doctor-overview"], queryFn: () => overviewFn({}) });
  const patients = useQuery({ queryKey: ["doctor-patients"], queryFn: () => patientsFn({}) });

  const appts = overview.data?.appointments ?? [];
  const today = appts.filter((a) => isToday(a.slot_at) && a.status !== "cancelled");
  const upcoming = appts.filter((a) => new Date(a.slot_at) > new Date() && !isToday(a.slot_at));
  const pending = (overview.data?.requests ?? []).filter((r) => r.status === "pending");

  if (overview.isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Doctor dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {overview.data?.doctor?.specialty ?? "Clinician"} · Patient data is visible only with active consent.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={CalendarDays} label="Today's appointments" value={today.length} />
        <Stat icon={CalendarDays} label="Upcoming appointments" value={upcoming.length} />
        <Stat icon={FileHeart} label="Pending consent requests" value={pending.length} />
        <Stat icon={Users} label="Consented patients" value={patients.data?.length ?? 0} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <h2 className="text-lg font-semibold">Today's appointments</h2>
          {today.length === 0 && (
            <EmptyState icon={CalendarDays} title="Nothing today" description="Your next bookings will show here." />
          )}
          {today.map((a) => (
            <article key={a.id} className="card-soft flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{a.patient_name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.slot_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {a.mode}
                  {a.reason ? ` · ${a.reason}` : ""}
                </p>
              </div>
              <StatusChip status={a.status} />
            </article>
          ))}

          <h2 className="pt-2 text-lg font-semibold">Upcoming</h2>
          {upcoming.slice(0, 5).map((a) => (
            <article key={a.id} className="card-soft flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{a.patient_name}</p>
                <p className="text-xs text-muted-foreground">{new Date(a.slot_at).toLocaleString()}</p>
              </div>
              <StatusChip status={a.status} />
            </article>
          ))}
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming appointments.</p>}
        </section>

        <aside className="space-y-4">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Pending requests</h2>
            {pending.length === 0 && <p className="text-sm text-muted-foreground">No requests awaiting a response.</p>}
            {pending.map((r) => (
              <div key={r.id} className="card-soft p-4">
                <p className="font-medium">{r.patient_name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.requested_categories.map(categoryLabel).join(", ")}
                </p>
                <StatusChip status={r.status} />
              </div>
            ))}
            <Link to="/doctor/requests" className="text-sm font-medium text-primary">
              Manage requests →
            </Link>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Recently authorized patients</h2>
            {(patients.data ?? []).slice(0, 5).map((p) => (
              <Link
                key={p.patient_id}
                to="/doctor/patients/$patientId"
                params={{ patientId: p.patient_id }}
                className="card-soft block p-4 hover:bg-accent"
              >
                <p className="font-medium">{p.full_name}</p>
                <p className="font-mono text-xs text-muted-foreground">{p.universal_id}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.categories.map(categoryLabel).join(", ")}
                </p>
              </Link>
            ))}
            {(patients.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No active consent yet.</p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Notifications</h2>
            {(overview.data?.notifications ?? []).slice(0, 5).map((n) => (
              <div key={n.id} className="card-soft flex gap-3 p-3">
                <Bell className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                </div>
              </div>
            ))}
            {(overview.data?.notifications ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing new.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

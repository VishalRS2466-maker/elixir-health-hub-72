import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, FlaskConical, Pill, Scan, Search, Stethoscope, Store } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import * as DirectoryService from "@/services/directory";
import * as BookingService from "@/services/bookings";
import * as AuditService from "@/services/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, StatusChip } from "@/components/EmptyState";
import { AskAiButton } from "@/components/ai/AiAssistant";

export const Route = createFileRoute("/_authenticated/app/hospital")({
  head: () => ({
    meta: [
      { title: "E-Hospital · ELIXIR" },
      { name: "description", content: "Book doctors, lab tests and scans, and find medicines at nearby pharmacies." },
      { property: "og:title", content: "E-Hospital · ELIXIR" },
      { property: "og:description", content: "Doctor appointments, lab tests, scans and pharmacy information." },
    ],
  }),
  component: HospitalPage,
});

type Tab = "doctor" | "lab" | "scan" | "pharmacy";

const TABS: { id: Tab; label: string; icon: typeof Stethoscope }[] = [
  { id: "doctor", label: "Doctors", icon: Stethoscope },
  { id: "lab", label: "Lab tests", icon: FlaskConical },
  { id: "scan", label: "Scans", icon: Scan },
  { id: "pharmacy", label: "Pharmacy", icon: Store },
];

function HospitalPage() {
  const [tab, setTab] = useState<Tab>("doctor");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">E-Hospital</h1>
        <p className="text-sm text-muted-foreground">
          Demo healthcare providers — bookings are stored in your ELIXIR account.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 text-xs font-semibold ${
              tab === t.id ? "bg-card shadow-soft" : "text-muted-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "doctor" && <DoctorsTab />}
      {tab === "lab" && <ServicesTab kind="test" />}
      {tab === "scan" && <ServicesTab kind="scan" />}
      {tab === "pharmacy" && <PharmacyTab />}
    </div>
  );
}

function DoctorsTab() {
  const { user, profile } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [slot, setSlot] = useState<string>("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const doctors = useQuery({ queryKey: ["doctors"], queryFn: DirectoryService.listDoctors });
  const appointments = useQuery({
    queryKey: ["appointments", user?.id],
    queryFn: () => BookingService.listAppointments(user!.id),
    enabled: !!user,
  });
  const slots = useMemo(() => BookingService.demoSlots(), []);

  const list = (doctors.data ?? []).filter((d) => {
    const q = search.toLowerCase();
    return (
      !q ||
      d.full_name.toLowerCase().includes(q) ||
      d.specialty.toLowerCase().includes(q) ||
      (d.hospitals?.name ?? "").toLowerCase().includes(q)
    );
  });

  async function book(doctorId: string, doctorUserId: string | null) {
    if (!user || !slot) {
      toast.error("Choose a time slot first");
      return;
    }
    setBusy(true);
    try {
      await BookingService.bookAppointment({
        patient_id: user.id,
        doctor_id: doctorId,
        doctor_user_id: doctorUserId,
        slot_at: slot,
        reason: reason || "General consultation",
        status: "pending",
      });
      await AuditService.log({
        actorId: user.id,
        actorName: profile?.full_name ?? "Patient",
        actorRole: "patient",
        patientId: user.id,
        action: "Booked doctor appointment",
        resource: "Appointment",
        consentStatus: "self",
      });
      await qc.invalidateQueries({ queryKey: ["appointments", user.id] });
      toast.success("Appointment requested");
      setSelected(null);
      setSlot("");
      setReason("");
    } catch {
      toast.error("Could not book the appointment. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search doctor, specialty or hospital"
          className="rounded-2xl pl-9"
        />
      </div>

      {doctors.isLoading && <p className="text-sm text-muted-foreground">Loading doctors…</p>}
      {!doctors.isLoading && list.length === 0 && (
        <EmptyState icon={Stethoscope} title="No doctors found" description="Try another specialty or hospital name." />
      )}

      {list.map((d) => (
        <article key={d.id} className="card-soft p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{d.full_name}</h3>
              <p className="text-sm text-muted-foreground">
                {d.specialty} · {d.qualification}
              </p>
              <p className="text-xs text-muted-foreground">
                {d.hospitals?.name ?? "Independent"} · {d.experience_years} yrs · ⭐ {d.rating}
              </p>
              <p className="mt-1 text-sm font-medium">Consultation fee ₹{d.fee}</p>
            </div>
            <Button
              className="rounded-2xl"
              onClick={() => setSelected(selected === d.id ? null : d.id)}
            >
              {selected === d.id ? "Close" : "Book"}
            </Button>
          </div>
          {d.bio && <p className="mt-2 text-sm">{d.bio}</p>}

          {selected === d.id && (
            <div className="mt-4 space-y-3 rounded-2xl bg-muted p-3">
              <p className="text-sm font-semibold">Available demo slots</p>
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    key={s.iso}
                    onClick={() => setSlot(s.iso)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      slot === s.iso ? "border-primary bg-brand-soft" : "bg-card"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for visit (optional)"
                className="rounded-xl bg-card"
              />
              <Button
                className="w-full rounded-2xl"
                disabled={busy || !slot}
                onClick={() => book(d.id, d.user_id)}
              >
                {busy ? "Booking…" : "Confirm appointment"}
              </Button>
            </div>
          )}
        </article>
      ))}

      <section className="card-soft p-5">
        <h2 className="mb-3 text-lg font-semibold">My appointments</h2>
        {(appointments.data ?? []).length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No appointments yet"
            description="Book a doctor to see your appointments here."
          />
        ) : (
          <ul className="space-y-2">
            {(appointments.data ?? []).map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-2xl border p-3">
                <CalendarClock className="h-5 w-5 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.doctors?.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.slot_at).toLocaleString()} · {a.reason}
                  </p>
                </div>
                <StatusChip status={a.status} />
                {a.status !== "cancelled" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await BookingService.setAppointmentStatus(a.id, "cancelled");
                      await qc.invalidateQueries({ queryKey: ["appointments", user?.id] });
                      toast.success("Appointment cancelled");
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <AskAiButton
          className="mt-3"
          label="My appointments"
          question="Help me prepare for my appointment"
        />
      </section>
    </div>
  );
}

function ServicesTab({ kind }: { kind: "test" | "scan" }) {
  const { user, profile } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [slot, setSlot] = useState("");
  const services = useQuery({
    queryKey: ["lab-services", kind],
    queryFn: () => DirectoryService.listLabServices(kind),
  });
  const bookings = useQuery({
    queryKey: ["service-bookings", user?.id],
    queryFn: () => BookingService.listServiceBookings(user!.id),
    enabled: !!user,
  });
  const slots = useMemo(() => BookingService.demoSlots(4), []);

  const list = (services.data ?? []).filter((s) => {
    const q = search.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || (s.laboratories?.name ?? "").toLowerCase().includes(q);
  });
  const myBookings = (bookings.data ?? []).filter((b) => b.kind === kind);

  async function book(service: (typeof list)[number]) {
    if (!user || !slot) {
      toast.error("Choose a slot first");
      return;
    }
    try {
      await BookingService.bookService({
        patient_id: user.id,
        lab_id: service.lab_id,
        service_id: service.id,
        service_name: service.name,
        kind,
        price: service.price,
        slot_at: slot,
      });
      await AuditService.log({
        actorId: user.id,
        actorName: profile?.full_name ?? "Patient",
        actorRole: "patient",
        patientId: user.id,
        action: kind === "test" ? "Booked lab test" : "Booked scan",
        resource: service.name,
        consentStatus: "self",
      });
      await qc.invalidateQueries({ queryKey: ["service-bookings", user.id] });
      toast.success("Booking confirmed");
      setSelected(null);
      setSlot("");
    } catch {
      toast.error("Could not complete the booking");
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={kind === "test" ? "Search a test or laboratory" : "Search a scan or centre"}
          className="rounded-2xl pl-9"
        />
      </div>

      {services.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!services.isLoading && list.length === 0 && (
        <EmptyState icon={FlaskConical} title="Nothing found" description="Try a different search term." />
      )}

      {list.map((s) => (
        <article key={s.id} className="card-soft p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{s.name}</h3>
              <p className="text-sm text-muted-foreground">{s.laboratories?.name}</p>
              <p className="text-xs text-muted-foreground">{s.prep_note}</p>
              <p className="mt-1 text-sm font-medium">₹{s.price} · demo price</p>
            </div>
            <Button className="rounded-2xl" onClick={() => setSelected(selected === s.id ? null : s.id)}>
              {selected === s.id ? "Close" : "Book"}
            </Button>
          </div>
          {selected === s.id && (
            <div className="mt-4 space-y-3 rounded-2xl bg-muted p-3">
              <div className="flex flex-wrap gap-2">
                {slots.map((sl) => (
                  <button
                    key={sl.iso}
                    onClick={() => setSlot(sl.iso)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      slot === sl.iso ? "border-primary bg-brand-soft" : "bg-card"
                    }`}
                  >
                    {sl.label}
                  </button>
                ))}
              </div>
              <Button className="w-full rounded-2xl" disabled={!slot} onClick={() => book(s)}>
                Confirm booking
              </Button>
            </div>
          )}
        </article>
      ))}

      <section className="card-soft p-5">
        <h2 className="mb-3 text-lg font-semibold">My {kind === "test" ? "test" : "scan"} bookings</h2>
        {myBookings.length === 0 ? (
          <EmptyState
            icon={kind === "test" ? FlaskConical : Scan}
            title="No bookings yet"
            description={`Book a ${kind === "test" ? "lab test" : "scan"} to see it here.`}
          />
        ) : (
          <ul className="space-y-2">
            {myBookings.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-2xl border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.service_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.laboratories?.name} · {new Date(b.slot_at).toLocaleString()}
                  </p>
                </div>
                <StatusChip status={b.status} />
                {b.status === "booked" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await BookingService.cancelServiceBooking(b.id);
                      await qc.invalidateQueries({ queryKey: ["service-bookings", user?.id] });
                      toast.success("Booking cancelled");
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PharmacyTab() {
  const [search, setSearch] = useState("");
  const medicines = useQuery({
    queryKey: ["medicines-catalog", search],
    queryFn: () => DirectoryService.listMedicines(search),
  });
  const pharmacies = useQuery({ queryKey: ["pharmacies"], queryFn: DirectoryService.listPharmacies });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a medicine"
          className="rounded-2xl pl-9"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Information only. ELIXIR does not sell or deliver medicines — availability is demo data.
      </p>

      {(medicines.data ?? []).map((m) => (
        <article key={m.id} className="card-soft p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{m.name}</h3>
              <p className="text-sm text-muted-foreground">
                {m.generic_name} · {m.form}
              </p>
              <p className="mt-1 text-sm">{m.used_for}</p>
              <p className="text-xs text-muted-foreground">Typical dosage: {m.common_dosage}</p>
            </div>
            <span className="rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold">₹{m.price}</span>
          </div>
          <AskAiButton
            className="mt-3"
            label={m.name}
            data={JSON.stringify(m)}
            question={`What should I know about ${m.name}?`}
          />
        </article>
      ))}
      {(medicines.data ?? []).length === 0 && (
        <EmptyState icon={Pill} title="No medicine found" description="Try another name, e.g. Paracetamol." />
      )}

      <section className="card-soft p-5">
        <h2 className="mb-3 text-lg font-semibold">Nearby pharmacies</h2>
        <ul className="space-y-2">
          {(pharmacies.data ?? []).map((p) => (
            <li key={p.id} className="rounded-2xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.distance_km} km · {p.open_24x7 ? "Open 24 hours" : p.opening_hours}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.address}</p>
                </div>
                <a href={`tel:${(p.phone ?? "").replace(/\s/g, "")}`} className="text-sm font-medium text-primary">
                  Call
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

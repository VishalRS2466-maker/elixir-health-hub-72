import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  Crosshair,
  FlaskConical,
  MapPin,
  Phone,
  Pill,
  Scan,
  Search,
  Star,
  Stethoscope,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import * as DirectoryService from "@/services/directory";
import * as BookingService from "@/services/bookings";
import * as AuditService from "@/services/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, StatusChip } from "@/components/EmptyState";
import { AskAiButton } from "@/components/ai/AiAssistant";
import { NearbyMap } from "@/components/NearbyMap";
import { FacilityBookingDialog } from "@/components/hospital/FacilityBookingDialog";
import { geocodeLocation } from "@/lib/places.functions";
import {
  LocationService,
  formatDistance,
  type Coords,
  type Facility,
  type FacilityKind,
  type GeoError,
} from "@/services/location";

export const Route = createFileRoute("/_authenticated/app/hospital")({
  head: () => ({
    meta: [
      { title: "E-Hospital · ELIXIR" },
      {
        name: "description",
        content:
          "Find hospitals, labs and diagnostic centres near you and book lab tests, scans and doctor appointments.",
      },
      { property: "og:title", content: "E-Hospital · ELIXIR" },
      {
        property: "og:description",
        content: "Location-based hospital, lab test and scan booking with doctor appointments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HospitalPage,
});

type Tab = "nearby" | "doctor" | "pharmacy" | "bookings";

const TABS: { id: Tab; label: string; icon: typeof Stethoscope }[] = [
  { id: "nearby", label: "Nearby", icon: MapPin },
  { id: "doctor", label: "Doctors", icon: Stethoscope },
  { id: "pharmacy", label: "Pharmacy", icon: Store },
  { id: "bookings", label: "Bookings", icon: CalendarClock },
];

function HospitalPage() {
  const [tab, setTab] = useState<Tab>("nearby");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">E-Hospital</h1>
        <p className="text-sm text-muted-foreground">
          Hospitals, labs and scan centres around you — book tests, scans and doctors in a few taps.
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

      {tab === "nearby" && <NearbyTab />}
      {tab === "doctor" && <DoctorsTab />}
      {tab === "pharmacy" && <PharmacyTab />}
      {tab === "bookings" && <MyBookings />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Nearby facilities + booking                                         */
/* ------------------------------------------------------------------ */

const SAMPLE_CENTRE: Coords = { lat: 12.9716, lng: 77.5946 };

const KIND_FILTERS: { id: FacilityKind; label: string; icon: typeof Building2 }[] = [
  { id: "hospitals", label: "Hospitals", icon: Building2 },
  { id: "labs", label: "Laboratories", icon: FlaskConical },
  { id: "scans", label: "Diagnostic centres", icon: Scan },
];

function NearbyTab() {
  const [kind, setKind] = useState<FacilityKind>("hospitals");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState(8000);
  const [center, setCenter] = useState<Coords>(SAMPLE_CENTRE);
  const [locationLabel, setLocationLabel] = useState("Bengaluru (sample area)");
  const [geoState, setGeoState] = useState<"idle" | "locating" | "error">("locating");
  const [geoError, setGeoError] = useState<GeoError | null>(null);
  const [manual, setManual] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [availableToday, setAvailableToday] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const [booking, setBooking] = useState<{ facility: Facility; kind: "test" | "scan" } | null>(null);

  const locate = useCallback(() => {
    setGeoState("locating");
    setGeoError(null);
    LocationService.getCurrentPosition()
      .then((coords) => {
        setCenter(coords);
        setUserLocation(coords);
        setLocationLabel("Your current location");
        setGeoState("idle");
      })
      .catch((err: GeoError) => {
        setGeoError(err);
        setGeoState("error");
      });
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 500);
    return () => window.clearTimeout(t);
  }, [search]);

  async function applyManualLocation() {
    if (manual.trim().length < 2) return;
    setManualBusy(true);
    try {
      const result = await geocodeLocation({ data: { query: manual.trim() } });
      setCenter({ lat: result.lat, lng: result.lng });
      setLocationLabel(result.label);
      setGeoState("idle");
      setGeoError(null);
    } catch {
      toast.error("We could not find that location. Try a city, area or pin code.");
    } finally {
      setManualBusy(false);
    }
  }

  const results = useQuery({
    queryKey: ["hospital-nearby", kind, query, radius, center.lat.toFixed(3), center.lng.toFixed(3)],
    queryFn: () =>
      LocationService.searchFacilities({
        kind,
        center,
        radiusMeters: radius,
        ...(query ? { query } : {}),
      }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const facilities = useMemo(() => {
    const list = (results.data?.facilities ?? []).filter((f) => {
      if (!availableToday) return true;
      return f.openNow !== false && BookingService.hasSlotsToday(f.id);
    });
    return [...list].sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  }, [results.data, availableToday]);

  return (
    <div className="space-y-4">
      {/* Location bar */}
      <section className="card-soft space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-primary" aria-hidden />
            {geoState === "locating" ? "Detecting your location…" : locationLabel}
          </p>
          <Button variant="outline" size="sm" className="rounded-2xl" onClick={locate}>
            <Crosshair className="mr-1.5 h-4 w-4" aria-hidden /> Use my location
          </Button>
        </div>
        {geoState === "error" && geoError && (
          <p className="text-xs text-muted-foreground">
            {geoError.message} You can type a location below instead.
          </p>
        )}
        <div className="flex gap-2">
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void applyManualLocation();
            }}
            placeholder="Enter a city, area or pin code"
            className="rounded-2xl"
          />
          <Button
            variant="secondary"
            className="rounded-2xl"
            disabled={manualBusy}
            onClick={() => void applyManualLocation()}
          >
            {manualBusy ? "Finding…" : "Set"}
          </Button>
        </div>
      </section>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {KIND_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setKind(f.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
              kind === f.id ? "border-primary bg-brand-soft" : "bg-card"
            }`}
          >
            <f.icon className="h-3.5 w-3.5" aria-hidden />
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setAvailableToday((v) => !v)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            availableToday ? "border-primary bg-brand-soft" : "bg-card"
          }`}
        >
          Available today
        </button>
        <select
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium"
          aria-label="Search radius"
        >
          <option value={2000}>Within 2 km</option>
          <option value={5000}>Within 5 km</option>
          <option value={8000}>Within 8 km</option>
          <option value={15000}>Within 15 km</option>
          <option value={30000}>Within 30 km</option>
        </select>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a hospital, lab or diagnostic centre"
          className="rounded-2xl pl-9"
        />
      </div>

      {results.data?.warning && (
        <p className="rounded-2xl bg-muted p-3 text-xs text-muted-foreground">{results.data.warning}</p>
      )}
      {results.isError && (
        <p className="rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
          Nearby search is unavailable right now. Try again in a moment or change the location.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] xl:gap-5">
        <NearbyMap
          userLocation={userLocation}
          center={center}
          places={facilities.map((f) => ({
            id: f.id,
            name: f.name,
            lat: f.lat,
            lng: f.lng,
            category: f.kind,
          }))}
          activeId={activeId}
          onSelect={setActiveId}
          category={kind}
          className="h-[46vh] min-h-[320px] w-full md:h-[56vh] lg:sticky lg:top-20 lg:h-[calc(100vh-9rem)]"
        />

        <div className="space-y-3 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-1">
          {results.isLoading &&
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-36 w-full rounded-3xl" />)}

          {!results.isLoading && facilities.length === 0 && (
            <EmptyState
              icon={Building2}
              title="No facilities found"
              description="Try a wider radius, a different filter or another location."
            />
          )}

          {facilities.map((f) => (
            <FacilityCard
              key={f.id}
              facility={f}
              active={activeId === f.id}
              onFocus={() => setActiveId(f.id)}
              onBook={(bookKind) => setBooking({ facility: f, kind: bookKind })}
            />
          ))}
        </div>
      </div>

      <FacilityBookingDialog
        facility={booking?.facility ?? null}
        kind={booking?.kind ?? "test"}
        open={!!booking}
        onOpenChange={(open) => !open && setBooking(null)}
      />
    </div>
  );
}

function FacilityCard({
  facility,
  active,
  onFocus,
  onBook,
}: {
  facility: Facility;
  active: boolean;
  onFocus: () => void;
  onBook: (kind: "test" | "scan") => void;
}) {
  const slotsToday = BookingService.hasSlotsToday(facility.id);
  const services = facility.elixir?.services ?? [];
  return (
    <article
      onMouseEnter={onFocus}
      className={`card-soft p-4 transition ${active ? "ring-2 ring-primary" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{facility.name}</h3>
          <p className="text-xs text-muted-foreground">
            {formatDistance(facility.distanceKm)}
            {facility.rating ? ` · ⭐ ${facility.rating}` : ""}
            {facility.openNow === true ? " · Open now" : facility.openNow === false ? " · Closed" : ""}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{facility.address}</p>
        </div>
        {facility.elixir?.emergencyAvailable && (
          <span className="shrink-0 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">
            Emergency
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-full bg-muted px-2 py-0.5">
          {facility.kind === "hospitals"
            ? "Hospital"
            : facility.kind === "labs"
              ? "Laboratory"
              : "Diagnostic centre"}
        </span>
        {slotsToday && (
          <span className="rounded-full bg-sage-soft px-2 py-0.5 font-medium">Slots available today</span>
        )}
        {services.slice(0, 2).map((s) => (
          <span key={s} className="rounded-full bg-muted px-2 py-0.5">
            {s}
          </span>
        ))}
        {(facility.elixir?.specialties ?? []).slice(0, 2).map((s) => (
          <span key={s} className="rounded-full bg-muted px-2 py-0.5">
            {s}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" className="rounded-2xl" onClick={() => onBook("test")}>
          <FlaskConical className="mr-1.5 h-4 w-4" aria-hidden /> Book test
        </Button>
        <Button size="sm" variant="secondary" className="rounded-2xl" onClick={() => onBook("scan")}>
          <Scan className="mr-1.5 h-4 w-4" aria-hidden /> Book scan
        </Button>
        <Button size="sm" variant="ghost" className="rounded-2xl" asChild>
          <a href={LocationService.directionsUrl(facility)} target="_blank" rel="noreferrer">
            <MapPin className="mr-1.5 h-4 w-4" aria-hidden /> Directions
          </a>
        </Button>
        {facility.phone && (
          <Button size="sm" variant="ghost" className="rounded-2xl" asChild>
            <a href={`tel:${facility.phone.replace(/\s/g, "")}`}>
              <Phone className="mr-1.5 h-4 w-4" aria-hidden /> Call
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* My bookings                                                         */
/* ------------------------------------------------------------------ */

function MyBookings() {
  const { user } = useSession();
  const qc = useQueryClient();
  const appointments = useQuery({
    queryKey: ["appointments", user?.id],
    queryFn: () => BookingService.listAppointments(user!.id),
    enabled: !!user,
  });
  const bookings = useQuery({
    queryKey: ["service-bookings", user?.id],
    queryFn: () => BookingService.listServiceBookings(user!.id),
    enabled: !!user,
  });

  const serviceRows = bookings.data ?? [];

  return (
    <div className="space-y-4">
      <section className="card-soft p-5">
        <h2 className="mb-3 text-lg font-semibold">Tests & scans</h2>
        {serviceRows.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="No test or scan bookings"
            description="Find a nearby hospital or lab and book a test or scan."
          />
        ) : (
          <ul className="space-y-2">
            {serviceRows.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-2xl border p-3">
                {b.kind === "scan" ? (
                  <Scan className="h-5 w-5 text-primary" aria-hidden />
                ) : (
                  <FlaskConical className="h-5 w-5 text-primary" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.service_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.facility_name ?? b.laboratories?.name ?? "Facility"} ·{" "}
                    {new Date(b.slot_at).toLocaleString()} · ₹{b.price}
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

      <section className="card-soft p-5">
        <h2 className="mb-3 text-lg font-semibold">Doctor appointments</h2>
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
                <CalendarClock className="h-5 w-5 text-primary" aria-hidden />
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

/* ------------------------------------------------------------------ */
/* Doctors                                                             */
/* ------------------------------------------------------------------ */

function DoctorsTab() {
  const { user, profile } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [slot, setSlot] = useState<string>("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const doctors = useQuery({ queryKey: ["doctors"], queryFn: DirectoryService.listDoctors });
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
      toast.success("Appointment requested — see the Bookings tab");
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
            <Button className="rounded-2xl" onClick={() => setSelected(selected === d.id ? null : d.id)}>
              {selected === d.id ? "Close" : "Book"}
            </Button>
          </div>
          {d.bio && <p className="mt-2 text-sm">{d.bio}</p>}

          {selected === d.id && (
            <div className="mt-4 space-y-3 rounded-2xl bg-muted p-3">
              <p className="text-sm font-semibold">Available slots</p>
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
              <Button className="w-full rounded-2xl" disabled={busy || !slot} onClick={() => book(d.id, d.user_id)}>
                {busy ? "Booking…" : "Confirm appointment"}
              </Button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pharmacy                                                            */
/* ------------------------------------------------------------------ */

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

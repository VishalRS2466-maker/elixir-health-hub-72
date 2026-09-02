import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock, FlaskConical, IndianRupee, MapPin, Scan } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/hooks/useSession";
import * as BookingService from "@/services/bookings";
import * as AuditService from "@/services/audit";
import { listCatalogServices, servicesForFacility, type CatalogService } from "@/services/catalog";
import { formatDistance, type Facility } from "@/services/location";

type Step = "service" | "schedule" | "review" | "done";

export function FacilityBookingDialog({
  facility,
  kind,
  open,
  onOpenChange,
}: {
  facility: Facility | null;
  kind: "test" | "scan";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, profile } = useSession();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<CatalogService | null>(null);
  const [day, setDay] = useState<string>("");
  const [slot, setSlot] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => BookingService.bookingDays(), []);
  const catalog = useQuery({
    queryKey: ["catalog-services", kind],
    queryFn: () => listCatalogServices(kind),
    staleTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (open) {
      setStep("service");
      setService(null);
      setSlot("");
      setDay(days[0]?.iso ?? "");
    }
  }, [open, facility?.id, kind, days]);

  const facilityKind = facility?.kind ?? "hospitals";
  const services = servicesForFacility(catalog.data ?? [], facilityKind);
  const slots = useMemo(
    () => (day && facility ? BookingService.slotsForDay(day, facility.id) : []),
    [day, facility],
  );

  async function confirm() {
    if (!user || !facility || !service || !slot) return;
    setBusy(true);
    try {
      await BookingService.bookService({
        patient_id: user.id,
        lab_id: facility.elixir && facility.kind !== "hospitals" ? facility.elixir.id : null,
        service_id: null,
        service_name: service.name,
        kind,
        price: service.price,
        slot_at: slot,
        facility_name: facility.name,
        facility_address: facility.address,
        facility_place_id: facility.source === "google" ? facility.id : null,
        facility_kind: facility.kind,
      });
      await AuditService.log({
        actorId: user.id,
        actorName: profile?.full_name ?? "User",
        actorRole: "patient",
        patientId: user.id,
        action: kind === "test" ? "Booked lab test" : "Booked scan",
        resource: `${service.name} · ${facility.name}`,
        consentStatus: "self",
      });
      await qc.invalidateQueries({ queryKey: ["service-bookings", user.id] });
      setStep("done");
    } catch {
      toast.error("Could not complete the booking. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const Icon = kind === "test" ? FlaskConical : Scan;
  const slotDate = slot ? new Date(slot) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" aria-hidden />
            {kind === "test" ? "Book a lab test" : "Book a scan"}
          </DialogTitle>
          <DialogDescription className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {facility?.name}
              {facility?.distanceKm !== null && facility?.distanceKm !== undefined
                ? ` · ${formatDistance(facility.distanceKm)}`
                : ""}
            </span>
          </DialogDescription>
        </DialogHeader>

        <Steps step={step} />

        {step === "service" && (
          <div className="space-y-2">
            {catalog.isLoading && <p className="text-sm text-muted-foreground">Loading services…</p>}
            {!catalog.isLoading && services.length === 0 && (
              <p className="text-sm text-muted-foreground">
                This centre does not list {kind === "test" ? "lab tests" : "scans"}. Try a hospital or
                diagnostic centre nearby.
              </p>
            )}
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setService(s);
                  setStep("schedule");
                }}
                className="w-full rounded-2xl border p-3 text-left transition hover:border-primary hover:bg-brand-soft/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.info}</p>
                    {s.prep_note && (
                      <p className="mt-1 text-xs text-muted-foreground">Prep: {s.prep_note}</p>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center text-sm font-semibold">
                    <IndianRupee className="h-3.5 w-3.5" aria-hidden />
                    {s.price}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === "schedule" && service && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <CalendarDays className="h-4 w-4" aria-hidden /> Choose a date
              </p>
              <div className="flex flex-wrap gap-2">
                {days.map((d) => (
                  <button
                    key={d.iso}
                    onClick={() => {
                      setDay(d.iso);
                      setSlot("");
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      day === d.iso ? "border-primary bg-brand-soft" : "bg-card"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Clock className="h-4 w-4" aria-hidden /> Choose a time slot
              </p>
              {slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No slots left on this day. Please pick another date.
                </p>
              ) : (
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
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => setStep("service")}>
                Back
              </Button>
              <Button className="flex-1 rounded-2xl" disabled={!slot} onClick={() => setStep("review")}>
                Review booking
              </Button>
            </div>
          </div>
        )}

        {step === "review" && service && slotDate && (
          <div className="space-y-4">
            <dl className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
              <Row label={kind === "test" ? "Test" : "Scan"} value={service.name} />
              <Row label="Facility" value={facility?.name ?? ""} />
              <Row label="Address" value={facility?.address ?? ""} />
              <Row label="Date & time" value={slotDate.toLocaleString()} />
              <Row label="Duration" value={`${service.duration_min} min`} />
              <Row label="Price" value={`₹${service.price}`} />
            </dl>
            {service.prep_note && (
              <p className="rounded-2xl border border-dashed p-3 text-xs text-muted-foreground">
                Preparation: {service.prep_note}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => setStep("schedule")}>
                Back
              </Button>
              <Button className="flex-1 rounded-2xl" disabled={busy} onClick={confirm}>
                {busy ? "Confirming…" : "Confirm booking"}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && service && slotDate && (
          <div className="space-y-4 py-2 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden />
            <div>
              <p className="text-lg font-semibold">Booking confirmed</p>
              <p className="text-sm text-muted-foreground">
                {service.name} at {facility?.name} on {slotDate.toLocaleString()}.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Added to My bookings. Demo booking — please call the centre to reconfirm.
              </p>
            </div>
            <Button className="w-full rounded-2xl" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Steps({ step }: { step: Step }) {
  const order: Step[] = ["service", "schedule", "review", "done"];
  const labels: Record<Step, string> = {
    service: "Service",
    schedule: "Date & time",
    review: "Review",
    done: "Confirmed",
  };
  const current = order.indexOf(step);
  return (
    <ol className="flex items-center gap-1.5 text-[11px] font-medium">
      {order.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          <span
            className={`rounded-full px-2.5 py-1 ${
              i <= current ? "bg-brand-soft text-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {labels[s]}
          </span>
          {i < order.length - 1 && <span className="text-muted-foreground">›</span>}
        </li>
      ))}
    </ol>
  );
}

import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarPlus,
  ExternalLink,
  MapPin,
  Phone,
  ShieldAlert,
  Star,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LocationService, formatDistance, type Facility } from "@/services/location";

const KIND_LABEL: Record<Facility["kind"], string> = {
  hospitals: "Hospital",
  pharmacies: "Pharmacy",
  labs: "Laboratory",
  scans: "Scan centre",
};

/**
 * Reusable facility panel. Only renders actions the underlying data supports —
 * no dead buttons, and no ELIXIR claims unless the database says so.
 */
export function HealthcareFacilityDetails({
  facility,
  open,
  onOpenChange,
}: {
  facility: Facility | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!facility) return null;

  const directions = LocationService.directionsUrl(facility);
  const phone = facility.phone ?? facility.elixir?.phone ?? null;
  const elixir = facility.elixir;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6 text-left">{facility.name}</DialogTitle>
          <DialogDescription className="text-left">
            {KIND_LABEL[facility.kind]}
            {facility.typeLabel ? ` · ${facility.typeLabel}` : ""} · {formatDistance(facility.distanceKm)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {facility.source === "demo" ? (
            <Chip tone="warm">ELIXIR sample data</Chip>
          ) : (
            <Chip tone="muted">Google Maps place</Chip>
          )}
          {facility.openNow === true && <Chip tone="success">Open now</Chip>}
          {facility.openNow === false && <Chip tone="muted">Closed</Chip>}
          {elixir?.partner && (
            <Chip tone="success">
              <BadgeCheck className="mr-1 h-3.5 w-3.5" /> ELIXIR partner
            </Chip>
          )}
          {elixir?.emergencyAvailable && (
            <Chip tone="danger">
              <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Emergency
            </Chip>
          )}
          {facility.rating !== null && (
            <Chip tone="warm">
              <Star className="mr-1 h-3.5 w-3.5" /> {facility.rating}
              {facility.ratingCount ? ` (${facility.ratingCount})` : ""}
            </Chip>
          )}
        </div>

        {facility.address && <p className="text-sm text-muted-foreground">{facility.address}</p>}

        {elixir && elixir.specialties.length > 0 && (
          <Section title="Specialties">{elixir.specialties.join(" · ")}</Section>
        )}
        {elixir && elixir.services.length > 0 && (
          <Section title="Services">{elixir.services.join(" · ")}</Section>
        )}
        {!elixir && (
          <p className="text-xs text-muted-foreground">
            This place is not yet listed in the ELIXIR provider directory, so bookings and partner
            services are not available here.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button asChild variant="outline" className="rounded-xl">
            <a href={directions} target="_blank" rel="noreferrer" aria-label={`Directions to ${facility.name}`}>
              <MapPin className="mr-2 h-4 w-4" /> Directions
            </a>
          </Button>
          {phone && (
            <Button asChild variant="outline" className="rounded-xl">
              <a href={`tel:${phone.replace(/\s/g, "")}`} aria-label={`Call ${facility.name}`}>
                <Phone className="mr-2 h-4 w-4" /> Call
              </a>
            </Button>
          )}
          {facility.website && (
            <Button asChild variant="outline" className="rounded-xl">
              <a href={facility.website} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Website
              </a>
            </Button>
          )}
          {elixir?.bookingAvailable && facility.kind === "hospitals" && (
            <>
              <Button asChild className="rounded-xl">
                <Link to="/app/hospital" search={{ hospital: elixir.id } as never}>
                  <Stethoscope className="mr-2 h-4 w-4" /> View doctors
                </Link>
              </Button>
              <Button asChild className="rounded-xl">
                <Link to="/app/hospital">
                  <CalendarPlus className="mr-2 h-4 w-4" /> Book appointment
                </Link>
              </Button>
            </>
          )}
          {elixir?.bookingAvailable && facility.kind !== "hospitals" && (
            <Button asChild className="rounded-xl">
              <Link to="/app/hospital">
                <CalendarPlus className="mr-2 h-4 w-4" /> Book test or scan
              </Link>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}

function Chip({
  tone,
  children,
}: {
  tone: "success" | "danger" | "warm" | "muted";
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "bg-success-soft"
      : tone === "danger"
        ? "bg-emergency-soft"
        : tone === "warm"
          ? "bg-warm-soft"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

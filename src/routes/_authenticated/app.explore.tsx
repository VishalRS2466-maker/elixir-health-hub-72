import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, FlaskConical, MapPin, Phone, Store } from "lucide-react";
import * as DirectoryService from "@/services/directory";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { AskAiButton } from "@/components/ai/AiAssistant";

export const Route = createFileRoute("/_authenticated/app/explore")({
  head: () => ({
    meta: [
      { title: "Explore nearby care · ELIXIR" },
      { name: "description", content: "Hospitals, pharmacies and test or scan centres near you." },
      { property: "og:title", content: "Explore nearby care · ELIXIR" },
      { property: "og:description", content: "Find hospitals, pharmacies and diagnostic centres nearby." },
    ],
  }),
  component: ExplorePage,
});

type Tab = "hospitals" | "pharmacies" | "labs";

function ExplorePage() {
  const [tab, setTab] = useState<Tab>("hospitals");
  const [search, setSearch] = useState("");

  const hospitals = useQuery({ queryKey: ["hospitals"], queryFn: DirectoryService.listHospitals });
  const pharmacies = useQuery({ queryKey: ["pharmacies"], queryFn: DirectoryService.listPharmacies });
  const labs = useQuery({ queryKey: ["labs"], queryFn: DirectoryService.listLaboratories });

  const q = search.trim().toLowerCase();
  const match = (name: string, address: string, extra: string[] = []) =>
    !q ||
    name.toLowerCase().includes(q) ||
    address.toLowerCase().includes(q) ||
    extra.some((e) => e.toLowerCase().includes(q));

  const active = tab === "hospitals" ? hospitals : tab === "pharmacies" ? pharmacies : labs;
  const filteredHospitals = (hospitals.data ?? []).filter((h) => match(h.name, h.address, h.specialties));
  const filteredPharmacies = (pharmacies.data ?? []).filter((p) => match(p.name, p.address));
  const filteredLabs = (labs.data ?? []).filter((l) => match(l.name, l.address, l.kinds));
  const visibleCount =
    tab === "hospitals"
      ? filteredHospitals.length
      : tab === "pharmacies"
        ? filteredPharmacies.length
        : filteredLabs.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Explore</h1>
        <p className="text-sm text-muted-foreground">
          Demo locations in Bengaluru. Directions open in OpenStreetMap.
        </p>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or area"
        className="rounded-2xl"
      />

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
        {([
          { id: "hospitals", label: "Hospitals", icon: Building2 },
          { id: "pharmacies", label: "Pharmacies", icon: Store },
          { id: "labs", label: "Tests & Scans", icon: FlaskConical },
        ] as const).map((t) => (
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

      {active.isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-soft h-28 animate-pulse bg-muted/60" />
          ))}
        </div>
      )}

      {active.isError && (
        <EmptyState
          icon={MapPin}
          title="Could not load nearby places"
          description="Something went wrong while fetching this list."
          action={
            <Button className="rounded-xl" onClick={() => void active.refetch()}>
              Try again
            </Button>
          }
        />
      )}

      {!active.isLoading && !active.isError && (
        <>
          {tab === "hospitals" &&
            filteredHospitals.map((h) => (
              <Card
                key={h.id}
                title={h.name}
                subtitle={`${h.distance_km} km away${h.emergency ? " · 24x7 Emergency" : ""}`}
                address={h.address}
                phone={h.phone}
                tags={h.specialties}
                lat={h.lat}
                lng={h.lng}
                actionTo="/app/hospital"
                actionLabel="Book a doctor"
              />
            ))}

          {tab === "pharmacies" &&
            filteredPharmacies.map((p) => (
              <Card
                key={p.id}
                title={p.name}
                subtitle={`${p.distance_km} km away · ${p.open_24x7 ? "Open now (24 hours)" : p.opening_hours}`}
                address={p.address}
                phone={p.phone}
                lat={p.lat}
                lng={p.lng}
              />
            ))}

          {tab === "labs" &&
            filteredLabs.map((l) => (
              <Card
                key={l.id}
                title={l.name}
                subtitle={`${l.distance_km} km away${l.home_collection ? " · Home collection" : ""}`}
                address={l.address}
                phone={l.phone}
                tags={l.kinds.map((k) => (k === "test" ? "Lab tests" : "Scans"))}
                lat={l.lat}
                lng={l.lng}
                actionTo="/app/hospital"
                actionLabel="Book test or scan"
              />
            ))}

          {visibleCount === 0 && (
            <EmptyState
              icon={MapPin}
              title={q ? `No matches for “${search.trim()}”` : "Nothing nearby yet"}
              description={
                q ? "Try a different name, area or speciality." : "Provider data will appear here."
              }
              action={
                q ? (
                  <Button variant="outline" className="rounded-xl" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                ) : undefined
              }
            />
          )}
        </>
      )}

      <AskAiButton label="Explore nearby healthcare" question="Find me a nearby test centre" />
    </div>
  );
}

function Card({
  title,
  subtitle,
  address,
  phone,
  tags,
  lat,
  lng,
  actionTo,
  actionLabel,
}: {
  title: string;
  subtitle: string;
  address: string;
  phone: string | null;
  tags?: string[];
  lat: number | null;
  lng: number | null;
  actionTo?: "/app/hospital";
  actionLabel?: string;
}) {
  return (
    <article className="card-soft p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
      <p className="mt-1 text-xs text-muted-foreground">{address}</p>
      {tags && tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="rounded-full bg-sage-soft px-2.5 py-1 text-[11px] font-medium">
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-4 text-sm font-medium text-primary">
        {phone && (
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1">
            <Phone className="h-4 w-4" /> Call
          </a>
        )}
        <a
          href={DirectoryService.LocationService.directionsUrl({ name: title, lat, lng })}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1"
        >
          <MapPin className="h-4 w-4" /> Directions
        </a>
        {actionTo && actionLabel && (
          <Link to={actionTo} className="inline-flex items-center gap-1">
            <CalendarPlus className="h-4 w-4" /> {actionLabel}
          </Link>
        )}
      </div>
    </article>
  );
}

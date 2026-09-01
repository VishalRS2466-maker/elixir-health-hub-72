import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Crosshair,
  FlaskConical,
  MapPin,
  Phone,
  Scan,
  Star,
  Store,
} from "lucide-react";
import { NearbyMap } from "@/components/NearbyMap";
import { HealthcareFacilityDetails } from "@/components/HealthcareFacilityDetails";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { AskAiButton } from "@/components/ai/AiAssistant";
import {
  LocationService,
  formatDistance,
  type Coords,
  type Facility,
  type FacilityKind,
  type GeoError,
} from "@/services/location";

export const Route = createFileRoute("/_authenticated/app/explore")({
  head: () => ({
    meta: [
      { title: "Explore healthcare near you · ELIXIR" },
      {
        name: "description",
        content: "Hospitals, pharmacies, laboratories and scan centres near you, on a live map.",
      },
      { property: "og:title", content: "Explore healthcare near you · ELIXIR" },
      {
        property: "og:description",
        content: "Find hospitals, pharmacies, labs and scan centres near your location.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExplorePage,
});

const TABS = [
  { id: "hospitals", label: "Hospitals", icon: Building2 },
  { id: "pharmacies", label: "Pharmacies", icon: Store },
  { id: "labs", label: "Laboratories", icon: FlaskConical },
  { id: "scans", label: "Scan Centres", icon: Scan },
] as const satisfies ReadonlyArray<{ id: FacilityKind; label: string; icon: typeof Building2 }>;

/** Sample area used only until the user shares a location or searches manually. */
const SAMPLE_CENTRE: Coords = { lat: 12.9716, lng: 77.5946 };
const SAMPLE_LABEL = "Bengaluru (sample area)";

type SortKey = "nearest" | "rating";

function ExplorePage() {
  const [kind, setKind] = useState<FacilityKind>("hospitals");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState(8000);
  const [center, setCenter] = useState<Coords>(SAMPLE_CENTRE);
  const [located, setLocated] = useState(false);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "error">("locating");
  const [geoError, setGeoError] = useState<GeoError | null>(null);
  const [sort, setSort] = useState<SortKey>("nearest");
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const locate = useCallback(() => {
    setGeoState("locating");
    setGeoError(null);
    LocationService.getCurrentPosition()
      .then((coords) => {
        setCenter(coords);
        setLocated(true);
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

  // Debounce the text search so we don't fan out a request per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 500);
    return () => window.clearTimeout(t);
  }, [search]);

  const results = useQuery({
    queryKey: ["nearby", kind, query, radius, center.lat.toFixed(3), center.lng.toFixed(3)],
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
      if (openNowOnly && f.openNow !== true) return false;
      if (emergencyOnly && !f.elixir?.emergencyAvailable) return false;
      return true;
    });
    return [...list].sort((a, b) =>
      sort === "rating"
        ? (b.rating ?? 0) - (a.rating ?? 0)
        : (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999),
    );
  }, [results.data, openNowOnly, emergencyOnly, sort]);

  const detailsFacility = facilities.find((f) => f.id === detailsId) ?? null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Explore Healthcare</h1>
        <p className="text-sm text-muted-foreground">
          {located
            ? "Facilities near your current location."
            : `Showing results around ${SAMPLE_LABEL} — share your location or search manually.`}
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search hospitals, pharmacies, labs..."
          aria-label="Search healthcare facilities"
          className="rounded-2xl"
        />
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={locate}
          disabled={geoState === "locating"}
        >
          <Crosshair className="mr-2 h-4 w-4" aria-hidden />
          {geoState === "locating" ? "Locating…" : located ? "Update my location" : "Use my location"}
        </Button>
      </div>

      {geoState === "error" && geoError && (
        <p role="status" className="text-xs text-muted-foreground">
          {geoError.message} You can still search manually — results are shown around {SAMPLE_LABEL}.
        </p>
      )}

      <div role="tablist" aria-label="Facility type" className="grid grid-cols-4 gap-1 rounded-2xl bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={kind === t.id}
            onClick={() => {
              setKind(t.id);
              setActiveId(null);
            }}
            className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold sm:text-xs ${
              kind === t.id ? "bg-card shadow-soft" : "text-muted-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={sort === "nearest"} onClick={() => setSort("nearest")}>
          Nearest
        </FilterChip>
        <FilterChip active={sort === "rating"} onClick={() => setSort("rating")}>
          Top rated
        </FilterChip>
        <FilterChip active={openNowOnly} onClick={() => setOpenNowOnly((v) => !v)}>
          Open now
        </FilterChip>
        <FilterChip active={emergencyOnly} onClick={() => setEmergencyOnly((v) => !v)}>
          Emergency
        </FilterChip>
        <span className="ml-1 text-xs text-muted-foreground">Within</span>
        {[2000, 5000, 10000, 15000].map((r) => (
          <FilterChip key={r} active={radius === r} onClick={() => setRadius(r)}>
            {r / 1000} km
          </FilterChip>
        ))}
      </div>

      {results.data?.warning && (
        <p role="status" className="rounded-2xl bg-warm-soft px-4 py-3 text-xs">
          {results.data.warning}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <NearbyMap
            center={center}
            places={facilities}
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id);
              setDetailsId(id);
            }}
            category={kind}
            className="h-56 w-full sm:h-72 lg:h-[32rem]"
          />
        </div>

        <div className="space-y-3">
          {results.isLoading &&
            [0, 1, 2].map((i) => <div key={i} className="card-soft h-28 animate-pulse bg-muted/60" />)}

          {results.isError && (
            <EmptyState
              icon={MapPin}
              title="Could not load nearby facilities"
              description={
                (results.error as Error)?.message ??
                "Something went wrong while searching. Check your connection and try again."
              }
              action={
                <Button className="rounded-xl" onClick={() => void results.refetch()}>
                  Try again
                </Button>
              }
            />
          )}

          {!results.isLoading &&
            !results.isError &&
            facilities.map((f) => (
              <FacilityCard
                key={f.id}
                facility={f}
                active={activeId === f.id}
                onFocus={() => setActiveId(f.id)}
                onOpen={() => setDetailsId(f.id)}
              />
            ))}

          {!results.isLoading && !results.isError && facilities.length === 0 && (
            <EmptyState
              icon={MapPin}
              title={query ? `No matches for “${query}”` : "Nothing found nearby"}
              description={
                openNowOnly || emergencyOnly
                  ? "No facilities match these filters. Try turning a filter off or widening the radius."
                  : "Try a different search, a wider radius, or updating your location."
              }
              action={
                query || openNowOnly || emergencyOnly ? (
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      setSearch("");
                      setOpenNowOnly(false);
                      setEmergencyOnly(false);
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      </div>

      <HealthcareFacilityDetails
        facility={detailsFacility}
        open={detailsId !== null}
        onOpenChange={(open) => !open && setDetailsId(null)}
      />

      <AskAiButton label="Explore nearby healthcare" question="Find me a nearby test centre" />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 rounded-full px-3 py-1 text-xs font-medium ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function FacilityCard({
  facility,
  active,
  onFocus,
  onOpen,
}: {
  facility: Facility;
  active: boolean;
  onFocus: () => void;
  onOpen: () => void;
}) {
  const directions = LocationService.directionsUrl(facility);
  const phone = facility.phone ?? facility.elixir?.phone ?? null;

  return (
    <article
      onMouseEnter={onFocus}
      className={`card-soft p-4 transition-shadow ${active ? "ring-2 ring-primary" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{facility.name}</h3>
        {facility.rating !== null && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-warm-soft px-2.5 py-1 text-xs font-medium">
            <Star className="h-3.5 w-3.5" aria-hidden /> {facility.rating}
            {facility.ratingCount ? ` (${facility.ratingCount})` : ""}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {formatDistance(facility.distanceKm)}
        {facility.typeLabel ? ` · ${facility.typeLabel}` : ""}
        {facility.openNow === true ? " · Open now" : facility.openNow === false ? " · Closed" : ""}
        {facility.source === "demo" ? " · sample data" : ""}
      </p>
      {facility.address && <p className="mt-1 text-xs text-muted-foreground">{facility.address}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-medium text-primary">
        <Button size="sm" className="rounded-xl" onClick={onOpen}>
          View details
        </Button>
        <a href={directions} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
          <MapPin className="h-4 w-4" aria-hidden /> Directions
        </a>
        {phone && (
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1">
            <Phone className="h-4 w-4" aria-hidden /> Call
          </a>
        )}
      </div>
    </article>
  );
}

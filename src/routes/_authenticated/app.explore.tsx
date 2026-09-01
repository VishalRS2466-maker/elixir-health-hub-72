import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  CalendarPlus,
  Crosshair,
  ExternalLink,
  FlaskConical,
  MapPin,
  Phone,
  Star,
  Store,
} from "lucide-react";
import { searchNearbyPlaces, type NearbyPlace } from "@/lib/places.functions";
import { NearbyMap } from "@/components/NearbyMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { AskAiButton } from "@/components/ai/AiAssistant";

export const Route = createFileRoute("/_authenticated/app/explore")({
  head: () => ({
    meta: [
      { title: "Explore nearby care · ELIXIR" },
      { name: "description", content: "Hospitals, pharmacies and test or scan centres near you, live on Google Maps." },
      { property: "og:title", content: "Explore nearby care · ELIXIR" },
      { property: "og:description", content: "Find hospitals, pharmacies and diagnostic centres near your location." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExplorePage,
});

type Tab = "hospitals" | "pharmacies" | "labs";

const TABS = [
  { id: "hospitals", label: "Hospitals", icon: Building2 },
  { id: "pharmacies", label: "Pharmacies", icon: Store },
  { id: "labs", label: "Tests & Scans", icon: FlaskConical },
] as const;

/** Fallback centre (Bengaluru) used until the browser shares a location. */
const FALLBACK = { lat: 12.9716, lng: 77.5946 };

function ExplorePage() {
  const [tab, setTab] = useState<Tab>("hospitals");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState(8000);
  const [center, setCenter] = useState(FALLBACK);
  const [located, setLocated] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Location is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocated(true);
        setGeoError(null);
      },
      () => setGeoError("Location permission denied — showing results around Bengaluru."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  // Debounce the text search so we don't fan out requests per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 500);
    return () => window.clearTimeout(t);
  }, [search]);

  const runSearch = useServerFn(searchNearbyPlaces);

  const results = useQuery({
    queryKey: ["nearby", tab, query, radius, center.lat.toFixed(3), center.lng.toFixed(3)],
    queryFn: () =>
      runSearch({
        data: { kind: tab, lat: center.lat, lng: center.lng, radiusMeters: radius, ...(query ? { query } : {}) },
      }) as Promise<NearbyPlace[]>,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const places = useMemo(() => results.data ?? [], [results.data]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Explore</h1>
        <p className="text-sm text-muted-foreground">
          Live hospitals, pharmacies and diagnostic centres near you, powered by Google Maps.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, area or speciality"
          className="rounded-2xl"
        />
        <Button variant="outline" className="rounded-2xl" onClick={locate}>
          <Crosshair className="mr-2 h-4 w-4" />
          {located ? "Update my location" : "Use my location"}
        </Button>
      </div>

      {geoError && <p className="text-xs text-muted-foreground">{geoError}</p>}

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setActiveId(null);
            }}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 text-xs font-semibold ${
              tab === t.id ? "bg-card shadow-soft" : "text-muted-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <NearbyMap center={center} places={places} activeId={activeId} onSelect={setActiveId} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Within</span>
        {[2000, 5000, 8000, 15000].map((r) => (
          <button
            key={r}
            onClick={() => setRadius(r)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              radius === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {r / 1000} km
          </button>
        ))}
      </div>

      {results.isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-soft h-28 animate-pulse bg-muted/60" />
          ))}
        </div>
      )}

      {results.isError && (
        <EmptyState
          icon={MapPin}
          title="Could not load nearby places"
          description={(results.error as Error)?.message ?? "Something went wrong while searching."}
          action={
            <Button className="rounded-xl" onClick={() => void results.refetch()}>
              Try again
            </Button>
          }
        />
      )}

      {!results.isLoading && !results.isError && (
        <>
          {places.map((p) => (
            <PlaceCard
              key={p.id}
              place={p}
              active={activeId === p.id}
              onFocus={() => setActiveId(p.id)}
              bookable={tab !== "pharmacies"}
              bookLabel={tab === "labs" ? "Book test or scan" : "Book a doctor"}
            />
          ))}

          {places.length === 0 && (
            <EmptyState
              icon={MapPin}
              title={query ? `No matches for “${query}”` : "Nothing found nearby"}
              description={
                query
                  ? "Try a different name or widen the search radius."
                  : "Try widening the radius or updating your location."
              }
              action={
                query ? (
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

function PlaceCard({
  place,
  active,
  onFocus,
  bookable,
  bookLabel,
}: {
  place: NearbyPlace;
  active: boolean;
  onFocus: () => void;
  bookable: boolean;
  bookLabel: string;
}) {
  const directions =
    place.mapsUri ??
    (place.lat !== null && place.lng !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`);

  return (
    <article
      onMouseEnter={onFocus}
      className={`card-soft p-4 transition-shadow ${active ? "ring-2 ring-primary" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{place.name}</h3>
        {place.rating !== null && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-warm-soft px-2.5 py-1 text-xs font-medium">
            <Star className="h-3.5 w-3.5" /> {place.rating}
            {place.ratingCount ? ` (${place.ratingCount})` : ""}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {place.distanceKm !== null ? `${place.distanceKm} km away` : "Nearby"}
        {place.typeLabel ? ` · ${place.typeLabel}` : ""}
        {place.openNow === true ? " · Open now" : place.openNow === false ? " · Closed" : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{place.address}</p>

      <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium text-primary">
        {place.phone && (
          <a href={`tel:${place.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1">
            <Phone className="h-4 w-4" /> Call
          </a>
        )}
        <a href={directions} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
          <MapPin className="h-4 w-4" /> Directions
        </a>
        {place.website && (
          <a href={place.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
            <ExternalLink className="h-4 w-4" /> Website
          </a>
        )}
        {bookable && (
          <Link to="/app/hospital" className="inline-flex items-center gap-1">
            <CalendarPlus className="h-4 w-4" /> {bookLabel}
          </Link>
        )}
      </div>
    </article>
  );
}

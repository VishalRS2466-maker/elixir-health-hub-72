import { supabase } from "@/integrations/supabase/client";
import { searchNearbyPlaces, type NearbyPlace } from "@/lib/places.functions";

/**
 * LocationService — the single seam between ELIXIR and any maps/places vendor.
 *
 * Components talk to LocationService only. Google-specific logic lives inside
 * GoogleMapsLocationProvider (which calls the server-side Places gateway), so
 * swapping providers later touches this file and nothing else.
 *
 * Data ownership:
 *  - place identity (name, address, coordinates, phone, opening state) -> provider
 *  - ELIXIR metadata (partner status, emergency, bookings, specialties) -> Supabase
 */

export type FacilityKind = "hospitals" | "pharmacies" | "labs" | "scans";

export type ElixirFacilityMeta = {
  id: string;
  partner: boolean;
  emergencyAvailable: boolean;
  bookingAvailable: boolean;
  specialties: string[];
  services: string[];
  phone: string | null;
};

export type Facility = NearbyPlace & {
  kind: FacilityKind;
  /** "google" = live place data, "demo" = ELIXIR sample provider data. */
  source: "google" | "demo";
  elixir: ElixirFacilityMeta | null;
};

export type Coords = { lat: number; lng: number };

export type SearchParams = {
  kind: FacilityKind;
  center: Coords;
  radiusMeters: number;
  query?: string;
};

export type SearchResult = {
  facilities: Facility[];
  source: "google" | "demo";
  /** Set when we had to fall back to ELIXIR demo providers. */
  warning: string | null;
};

export type GeoErrorKind = "unsupported" | "denied" | "unavailable" | "timeout";
export type GeoError = { kind: GeoErrorKind; message: string };

/* ------------------------------------------------------------------ */
/* Geolocation                                                         */
/* ------------------------------------------------------------------ */

export function getCurrentPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject({ kind: "unsupported", message: "This browser cannot share your location." } as GeoError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const kind: GeoErrorKind =
          err.code === err.PERMISSION_DENIED
            ? "denied"
            : err.code === err.TIMEOUT
              ? "timeout"
              : "unavailable";
        const message =
          kind === "denied"
            ? "Location access is unavailable."
            : kind === "timeout"
              ? "Finding your location took too long."
              : "Your location could not be determined.";
        reject({ kind, message } as GeoError);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  });
}

/* ------------------------------------------------------------------ */
/* Distance                                                            */
/* ------------------------------------------------------------------ */

export function distanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const km = 2 * R * Math.asin(Math.sqrt(s));
  return Math.round(km * 10) / 10;
}

export function formatDistance(km: number | null): string {
  if (km === null) return "Nearby";
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km} km away`;
}

/* ------------------------------------------------------------------ */
/* Provider abstraction                                                */
/* ------------------------------------------------------------------ */

export interface LocationProvider {
  id: string;
  label: string;
  searchNearby(params: SearchParams): Promise<NearbyPlace[]>;
  directionsUrl(facility: Pick<Facility, "name" | "lat" | "lng" | "mapsUri">): string;
}

export const GoogleMapsLocationProvider: LocationProvider = {
  id: "google-maps",
  label: "Google Maps",
  async searchNearby({ kind, center, radiusMeters, query }) {
    return (await searchNearbyPlaces({
      data: {
        kind,
        lat: center.lat,
        lng: center.lng,
        radiusMeters,
        ...(query ? { query } : {}),
      },
    })) as NearbyPlace[];
  },
  directionsUrl(facility) {
    if (facility.mapsUri) return facility.mapsUri;
    if (facility.lat !== null && facility.lng !== null) {
      return `https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facility.name)}`;
  },
};

/* ------------------------------------------------------------------ */
/* ELIXIR (Supabase) metadata merge                                    */
/* ------------------------------------------------------------------ */

const normalise = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type ElixirRow = {
  key: string;
  placeId: string | null;
  meta: ElixirFacilityMeta;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  openLabel: string | null;
};

async function loadElixirRows(kind: FacilityKind): Promise<ElixirRow[]> {
  try {
    if (kind === "hospitals") {
      const { data } = await supabase.from("hospitals").select("*");
      return (data ?? []).map((h) => ({
        key: normalise(h.name),
        placeId: (h as { google_place_id?: string | null }).google_place_id ?? null,
        name: h.name,
        address: h.address,
        lat: h.lat,
        lng: h.lng,
        openLabel: null,
        meta: {
          id: h.id,
          partner: !h.is_demo,
          emergencyAvailable: h.emergency,
          bookingAvailable: true,
          specialties: h.specialties ?? [],
          services: [],
          phone: h.phone,
        },
      }));
    }
    if (kind === "pharmacies") {
      const { data } = await supabase.from("pharmacies").select("*");
      return (data ?? []).map((p) => ({
        key: normalise(p.name),
        placeId: (p as { google_place_id?: string | null }).google_place_id ?? null,
        name: p.name,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        openLabel: p.open_24x7 ? "Open 24x7" : p.opening_hours,
        meta: {
          id: p.id,
          partner: !p.is_demo,
          emergencyAvailable: p.open_24x7,
          bookingAvailable: false,
          specialties: [],
          services: p.open_24x7 ? ["24x7 counter"] : [],
          phone: p.phone,
        },
      }));
    }
    const { data } = await supabase.from("laboratories").select("*");
    return (data ?? [])
      .filter((l) =>
        kind === "scans"
          ? (l.kinds ?? []).some((k) => k === "scan")
          : true,
      )
      .map((l) => ({
        key: normalise(l.name),
        placeId: (l as { google_place_id?: string | null }).google_place_id ?? null,
        name: l.name,
        address: l.address,
        lat: l.lat,
        lng: l.lng,
        openLabel: null,
        meta: {
          id: l.id,
          partner: !l.is_demo,
          emergencyAvailable: false,
          bookingAvailable: true,
          specialties: [],
          services: [
            ...(l.kinds ?? []).map((k) => (k === "scan" ? "Scans" : "Lab tests")),
            ...(l.home_collection ? ["Home sample collection"] : []),
          ],
          phone: l.phone,
        },
      }));
  } catch {
    return [];
  }
}

function toDemoFacility(row: ElixirRow, kind: FacilityKind, center: Coords): Facility {
  return {
    id: `elixir:${row.meta.id}`,
    name: row.name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    phone: row.meta.phone,
    rating: null,
    ratingCount: null,
    openNow: null,
    typeLabel: row.openLabel,
    mapsUri: null,
    website: null,
    distanceKm:
      row.lat !== null && row.lng !== null ? distanceKm(center, { lat: row.lat, lng: row.lng }) : null,
    kind,
    source: "demo",
    elixir: row.meta,
  };
}

/* ------------------------------------------------------------------ */
/* Public service                                                      */
/* ------------------------------------------------------------------ */

export const LocationService = {
  provider: GoogleMapsLocationProvider as LocationProvider,

  getCurrentPosition,
  distanceKm,
  formatDistance,

  directionsUrl(facility: Pick<Facility, "name" | "lat" | "lng" | "mapsUri">) {
    return this.provider.directionsUrl(facility);
  },

  async searchFacilities(params: SearchParams): Promise<SearchResult> {
    const elixirRows = await loadElixirRows(params.kind);

    try {
      const places = await this.provider.searchNearby(params);
      const byPlaceId = new Map(elixirRows.filter((r) => r.placeId).map((r) => [r.placeId!, r]));
      const byName = new Map(elixirRows.map((r) => [r.key, r]));

      const facilities: Facility[] = places.map((p) => {
        const match = byPlaceId.get(p.id) ?? byName.get(normalise(p.name)) ?? null;
        return { ...p, kind: params.kind, source: "google", elixir: match?.meta ?? null };
      });

      return { facilities, source: "google", warning: null };
    } catch (error) {
      const q = params.query ? normalise(params.query) : "";
      const facilities = elixirRows
        .filter((r) => !q || r.key.includes(q))
        .map((r) => toDemoFacility(r, params.kind, params.center))
        .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));

      if (facilities.length === 0) throw error;

      return {
        facilities,
        source: "demo",
        warning:
          "Live map results are unavailable right now — showing ELIXIR sample provider data instead.",
      };
    }
  },
};

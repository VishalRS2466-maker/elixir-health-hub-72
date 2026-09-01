import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * PlacesService (server side).
 * Live nearby healthcare lookup through the Google Maps Platform connector
 * gateway. Authenticated-only and bounded (fixed result cap, radius cap) so
 * Maps usage stays inside the app's own flows.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const KIND_TYPES = {
  hospitals: ["hospital"],
  pharmacies: ["pharmacy", "drugstore"],
  labs: ["medical_lab"],
  scans: ["medical_lab"],
} as const;

/** Text used when the caller searches by name/keyword. */
const KIND_TEXT = {
  hospitals: "hospital",
  pharmacies: "pharmacy",
  labs: "diagnostic lab",
  scans: "MRI CT scan diagnostic imaging centre",
} as const;

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.currentOpeningHours.openNow",
  "places.primaryTypeDisplayName",
].join(",");

const inputSchema = z.object({
  kind: z.enum(["hospitals", "pharmacies", "labs", "scans"]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().min(500).max(30000).optional(),
  query: z.string().trim().max(80).optional(),
});

export type NearbyPlace = {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  rating: number | null;
  ratingCount: number | null;
  openNow: boolean | null;
  typeLabel: string | null;
  mapsUri: string | null;
  website: string | null;
  distanceKm: number | null;
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  currentOpeningHours?: { openNow?: boolean };
  primaryTypeDisplayName?: { text?: string };
};

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 10) / 10;
}

async function callGateway(path: string, body: unknown) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) {
    throw new Error("Google Maps is not connected for this project yet.");
  }

  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": mapsKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 403) {
    const details: Array<{ reason?: string }> =
      ((await response.json().catch(() => null)) as { error?: { details?: Array<{ reason?: string }> } })
        ?.error?.details ?? [];
    const reason = details.find((d) => d.reason)?.reason;
    if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
      throw new Error(
        'Google Maps server key is referrer-restricted. In Google Cloud Console, set the server key\'s application restrictions to "None" or "IP addresses".',
      );
    }
    if (reason === "API_KEY_SERVICE_BLOCKED") {
      throw new Error(
        "Google Maps server key does not allow the Places API. In Google Cloud Console, add Places API (New) to the key's allowed-APIs list.",
      );
    }
    throw new Error("Google Maps request was denied (403). Check the server key restrictions.");
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Google Maps gateway failed [${response.status}]: ${errorBody}`);
    throw new Error(`Nearby search failed (${response.status})`);
  }

  return (await response.json()) as { places?: GooglePlace[] };
}

export const searchNearbyPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<NearbyPlace[]> => {
    const radius = data.radiusMeters ?? 8000;
    const center = { latitude: data.lat, longitude: data.lng };
    const includedTypes = KIND_TYPES[data.kind];

    const useText = Boolean(data.query) || data.kind === "scans";

    const result = useText
      ? await callGateway("/places/v1/places:searchText", {
          textQuery: `${data.query ?? ""} ${KIND_TEXT[data.kind]}`.trim(),
          maxResultCount: 20,
          locationBias: { circle: { center, radius } },
        })
      : await callGateway("/places/v1/places:searchNearby", {
          includedTypes: [...includedTypes],
          maxResultCount: 20,
          rankPreference: "DISTANCE",
          locationRestriction: { circle: { center, radius } },
        });

    return (result.places ?? [])
      .filter((p) => p.id)
      .map((p) => {
        const lat = p.location?.latitude ?? null;
        const lng = p.location?.longitude ?? null;
        return {
          id: p.id!,
          name: p.displayName?.text ?? "Unnamed place",
          address: p.formattedAddress ?? "",
          lat,
          lng,
          phone: p.nationalPhoneNumber ?? null,
          rating: p.rating ?? null,
          ratingCount: p.userRatingCount ?? null,
          openNow: p.currentOpeningHours?.openNow ?? null,
          typeLabel: p.primaryTypeDisplayName?.text ?? null,
          mapsUri: p.googleMapsUri ?? null,
          website: p.websiteUri ?? null,
          distanceKm: lat !== null && lng !== null ? haversineKm(data.lat, data.lng, lat, lng) : null,
        };
      })
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  });

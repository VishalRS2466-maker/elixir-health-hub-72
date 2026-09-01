# ELIXIR — Healthcare Management Platform

ELIXIR is a patient-centric healthcare app: one universal (ABHA-compatible) patient ID,
a timeline of medical records, a controlled emergency card, e-hospital bookings, medicine
reminders, a first aid library, an AI explainer, and full consent + audit trails.

## Stack

React 19 · TypeScript · Tailwind CSS v4 · TanStack Start / Router / Query · Lovable Cloud
(Postgres, Auth, Row Level Security).

## Roles

| Role | Sees |
| --- | --- |
| Patient | Own records, emergency card, bookings, medicines, consent, activity |
| Doctor | Own appointments; patient records **only** after explicit, time-limited consent |
| Admin | Users, provider directory and audit metadata — never medical records |

## Getting started

1. Open `/auth` and create an account. Pick a role during sign-up.
2. New patient accounts are seeded with realistic demo records, reminders and bookings so
   every screen is immediately usable.
3. To try the consent flow: sign up a doctor account, look up a patient's Universal ID
   (shown on the patient's Home and Profile pages), send a request, then approve it from
   the patient account under **Consent**.

## Privacy model

- Every table has Row Level Security; patients own their rows.
- Doctors read patient records only through an approved, non-expired consent request, and
  only within the approved categories.
- Consent decisions, record views, bookings and emergency shares are written to the audit
  log, which patients can read on **Access activity**.

## Prototype boundaries

- ABHA linking is compatible-by-design but not connected to the live ABDM network.
- Provider directory, distances and slots are demo data behind service seams
  (`src/services/directory.ts`, `bookings.ts`) that a real registry/scheduling API replaces.
- Reminders are confirmed by the user; browser notifications are local only.
- The AI assistant explains and navigates — it never diagnoses or prescribes.

## Environment variables

| Variable | Purpose | Required? | Where to configure |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Backend URL for the browser client | Yes | `.env` locally; managed automatically in Lovable Cloud |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable backend key (safe in the browser) | Yes | `.env`; managed in Lovable Cloud |
| `VITE_SUPABASE_PROJECT_ID` | Backend project reference | Yes | `.env`; managed in Lovable Cloud |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | Same values for SSR and server functions | Yes | `.env`; managed in Lovable Cloud |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` | Loads the Maps JavaScript API in the browser | Yes for the map | Google Maps connector |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID` | Usage channel tag | Optional | Google Maps connector |
| `GOOGLE_MAPS_API_KEY` | Server key used by the Places server function | Yes for nearby search | Google Maps connector (server-only) |
| `LOVABLE_API_KEY` | Auth for the connector gateway and AI gateway | Yes | Managed by the platform (server-only) |

No key is hardcoded anywhere in the source. `.env` files are git-ignored; `.env.example`
documents the shape without real values.

### Google Cloud setup (own key instead of the managed connector)

Enable **Maps JavaScript API** and **Places API (New)**. Create two keys:

- a browser key restricted by HTTP referrer to your local dev origin and your deployed
  domains (`https://example.com/*` *and* `https://*.example.com/*`),
- a server key with application restrictions set to **None** or **IP addresses** (server
  calls send no referrer) and API restrictions limited to Places API (New).

Set sensible daily quotas — Places is usage-metered.

## Deployment

This app is a TanStack Start SSR application: it builds to a server bundle plus static
assets and is deployed through Lovable hosting (Cloudflare Workers). It is **not** a
static SPA, so a Netlify-style `_redirects` / `netlify.toml` SPA fallback does not apply —
nested routes such as `/app/explore` are rendered by the server and survive a hard refresh
without any redirect rule. Server-only secrets (`GOOGLE_MAPS_API_KEY`, `LOVABLE_API_KEY`,
service-role access) stay in the server runtime and are never shipped to the browser.

## Explore architecture

- `src/services/location.ts` — `LocationService` plus a `LocationProvider` interface and
  `GoogleMapsLocationProvider`. Components never touch Google APIs directly.
- `src/lib/places.functions.ts` — authenticated server function calling Places API (New)
  through the connector gateway (bounded radius and result count).
- `src/components/NearbyMap.tsx` — single, de-duplicated Maps JS loader with marker cleanup;
  degrades to “Map unavailable right now.” while the list keeps working.
- `src/components/HealthcareFacilityDetails.tsx` — merged view: Google place identity plus
  ELIXIR metadata (partner status, emergency, bookings) from the database, matched on
  `google_place_id` and falling back to a normalised name match.
- Distances are computed from the user's coordinates (haversine), never hardcoded.
- If Places is unavailable, Explore falls back to ELIXIR sample provider rows, clearly
  labelled as sample data.

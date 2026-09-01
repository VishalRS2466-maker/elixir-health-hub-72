import { useEffect, useRef, useState } from "react";
import { MapPinOff } from "lucide-react";

/**
 * Google Maps JS map with markers for nearby places.
 * Uses the referrer-restricted browser key (safe in the client).
 * Fails soft: if the script or key is unavailable the map area shows a notice
 * and the surrounding list view keeps working.
 */

type MapPlace = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  category?: string;
};

declare global {
  interface Window {
    __elixirMapReady?: boolean;
    __initElixirMap?: () => void;
    google?: any;
  }
}

const BROWSER_KEY = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY'] as string | undefined;
const TRACKING_ID = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID'] as string | undefined;

const CATEGORY_COLOR: Record<string, string> = {
  hospitals: "#d1495b",
  pharmacies: "#2a9d8f",
  labs: "#719db3",
  scans: "#8367c7",
};

let loaderPromise: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.__elixirMapReady && window.google?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  if (!BROWSER_KEY) return Promise.reject(new Error("Missing Google Maps browser key"));

  loaderPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("elixir-gmaps") as HTMLScriptElement | null;
    window.__initElixirMap = () => {
      window.__elixirMapReady = true;
      resolve();
    };
    if (existing) return;

    const script = document.createElement("script");
    script.id = "elixir-gmaps";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__initElixirMap${
      TRACKING_ID ? `&channel=${TRACKING_ID}` : ""
    }`;
    script.async = true;
    script.onerror = () => {
      loaderPromise = null;
      script.remove();
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
    window.setTimeout(() => {
      if (!window.__elixirMapReady) reject(new Error("Google Maps took too long to load"));
    }, 12000);
  });
  return loaderPromise;
}

export function NearbyMap({
  center,
  places,
  activeId,
  onSelect,
  category,
  className,
}: {
  center: { lat: number; lng: number };
  places: MapPlace[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  category?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const listenersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(!BROWSER_KEY);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        if (!mapRef.current) {
          mapRef.current = new window.google.maps.Map(containerRef.current, {
            center,
            zoom: 13,
            disableDefaultUI: true,
            zoomControl: true,
            clickableIcons: false,
          });
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      listenersRef.current.forEach((l) => l?.remove?.());
      listenersRef.current = [];
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.setCenter(center);
  }, [ready, center.lat, center.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !window.google) return;

    listenersRef.current.forEach((l) => l?.remove?.());
    listenersRef.current = [];
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(center);

    places
      .filter((p) => p.lat !== null && p.lng !== null)
      .forEach((p) => {
        const color = CATEGORY_COLOR[p.category ?? category ?? "labs"] ?? "#719db3";
        const marker = new window.google.maps.Marker({
          map,
          position: { lat: p.lat as number, lng: p.lng as number },
          title: p.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: activeId === p.id ? 11 : 8,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        listenersRef.current.push(marker.addListener("click", () => onSelect?.(p.id)));
        markersRef.current.push(marker);
        bounds.extend(marker.getPosition());
      });

    if (places.length > 0) map.fitBounds(bounds, 48);
  }, [ready, places, activeId, category, center.lat, center.lng, onSelect]);

  if (failed) {
    return (
      <div
        role="status"
        className={`flex flex-col items-center justify-center gap-2 rounded-3xl bg-muted p-6 text-center ${
          className ?? "h-64 w-full sm:h-80"
        }`}
      >
        <MapPinOff className="h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Map unavailable right now.</p>
        <p className="text-xs text-muted-foreground">
          The facility list below still works — addresses, contact numbers and directions are available.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Map of nearby healthcare facilities"
      className={`overflow-hidden rounded-3xl bg-muted ${className ?? "h-64 w-full sm:h-80"}`}
    />
  );
}

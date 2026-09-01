import { useEffect, useRef } from "react";

/**
 * Google Maps JS map with markers for nearby places.
 * Uses the referrer-restricted browser key (safe in the client).
 */

type MapPlace = { id: string; name: string; lat: number | null; lng: number | null };

declare global {
  interface Window {
    __elixirMapReady?: boolean;
    __initElixirMap?: () => void;
    google?: any;
  }
}

const BROWSER_KEY = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY'] as string | undefined;
const TRACKING_ID = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID'] as string | undefined;

let loaderPromise: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.__elixirMapReady && window.google?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  if (!BROWSER_KEY) return Promise.reject(new Error("Missing Google Maps browser key"));

  loaderPromise = new Promise<void>((resolve, reject) => {
    window.__initElixirMap = () => {
      window.__elixirMapReady = true;
      resolve();
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__initElixirMap${
      TRACKING_ID ? `&channel=${TRACKING_ID}` : ""
    }`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

export function NearbyMap({
  center,
  places,
  activeId,
  onSelect,
}: {
  center: { lat: number; lng: number };
  places: MapPlace[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

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
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    map.setCenter(center);
  }, [center.lat, center.lng]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const map = mapRef.current;
      if (!map || !window.google) return;
      window.clearInterval(timer);

      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(center);

      places
        .filter((p) => p.lat !== null && p.lng !== null)
        .forEach((p) => {
          const marker = new window.google.maps.Marker({
            map,
            position: { lat: p.lat as number, lng: p.lng as number },
            title: p.name,
            animation: activeId === p.id ? window.google.maps.Animation.BOUNCE : null,
          });
          marker.addListener("click", () => onSelect?.(p.id));
          markersRef.current.push(marker);
          bounds.extend(marker.getPosition());
        });

      if (places.length > 0) map.fitBounds(bounds, 48);
    }, 120);
    return () => window.clearInterval(timer);
  }, [places, activeId, center.lat, center.lng, onSelect]);

  if (!BROWSER_KEY) return null;

  return <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-3xl bg-muted sm:h-80" />;
}

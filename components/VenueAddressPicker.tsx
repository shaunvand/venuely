"use client";

import { useEffect, useRef, useState } from "react";

type PlaceResult = {
  formatted_address: string;
  place_id: string;
  geometry: {
    location: { lat: () => number; lng: () => number };
  };
  url?: string;
  address_components?: Array<{ short_name: string; long_name: string; types: string[] }>;
};

type AddressValue = {
  address: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  google_maps_url: string | null;
};

declare global {
  interface Window {
    google?: typeof google;
    _venuelyMapsLoading?: Promise<void>;
  }
}

const SCRIPT_ID = "venuely-google-maps";

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (window._venuelyMapsLoading) return window._venuelyMapsLoading;

  window._venuelyMapsLoading = new Promise((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID)) {
      // Already injected — poll until ready.
      const check = () => {
        if (window.google?.maps?.places) resolve();
        else setTimeout(check, 100);
      };
      check();
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&v=weekly`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Google Maps. Check API key + referrer restrictions."));
    document.head.appendChild(s);
  });
  return window._venuelyMapsLoading;
}

function regionFromComponents(components: NonNullable<PlaceResult["address_components"]>): string {
  const findType = (t: string) => components.find((c) => c.types.includes(t))?.long_name;
  const region = findType("administrative_area_level_1") ?? findType("locality") ?? "";
  const country = findType("country");
  return country ? (region ? `${region}, ${country}` : country) : region;
}

export function VenueAddressPicker({
  apiKey,
  initial,
  name,
  onChange,
}: {
  apiKey: string | null;
  initial?: Partial<AddressValue>;
  name?: string;
  onChange?: (v: AddressValue) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerInstance = useRef<google.maps.Marker | null>(null);
  const [value, setValue] = useState<AddressValue>({
    address: initial?.address ?? "",
    region: initial?.region ?? "",
    latitude: initial?.latitude ?? null,
    longitude: initial?.longitude ?? null,
    google_place_id: initial?.google_place_id ?? null,
    google_maps_url: initial?.google_maps_url ?? null,
  });
  const [error, setError] = useState<string | null>(null);

  // Initialise the map + autocomplete once Maps SDK is loaded.
  useEffect(() => {
    if (!apiKey) {
      setError("Google Maps not configured — paste an address manually for now.");
      return;
    }
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !window.google || !inputRef.current || !mapRef.current) return;
        const startLat = value.latitude ?? -33.918861;  // Cape Town default
        const startLng = value.longitude ?? 18.4233;
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
          center: { lat: startLat, lng: startLng },
          zoom: value.latitude ? 14 : 5,
          disableDefaultUI: true,
          zoomControl: true,
          mapId: "venuely-setup-map",
        });
        if (value.latitude && value.longitude) {
          markerInstance.current = new window.google.maps.Marker({
            map: mapInstance.current,
            position: { lat: value.latitude, lng: value.longitude },
          });
        }

        const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "place_id", "geometry", "address_components", "url"],
          componentRestrictions: { country: ["za"] },
        });
        ac.bindTo("bounds", mapInstance.current);
        ac.addListener("place_changed", () => {
          const place = ac.getPlace() as unknown as PlaceResult;
          if (!place.geometry?.location) return;
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const region = place.address_components ? regionFromComponents(place.address_components) : "";
          const mapsUrl = place.url ?? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`;
          const next: AddressValue = {
            address: place.formatted_address,
            region,
            latitude: lat,
            longitude: lng,
            google_place_id: place.place_id,
            google_maps_url: mapsUrl,
          };
          setValue(next);
          onChange?.(next);
          if (mapInstance.current) {
            mapInstance.current.setCenter({ lat, lng });
            mapInstance.current.setZoom(15);
          }
          if (markerInstance.current) markerInstance.current.setMap(null);
          markerInstance.current = new window.google.maps.Marker({
            map: mapInstance.current!,
            position: { lat, lng },
          });
        });

        // Try geolocation as a hint for the map start position.
        if (!value.latitude && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (!mapInstance.current) return;
              mapInstance.current.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              mapInstance.current.setZoom(10);
            },
            () => {},
            { timeout: 4000, maximumAge: 60_000 }
          );
        }
      })
      .catch((e) => setError(e.message));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm font-medium">Venue address</label>
        <input
          ref={inputRef}
          required
          autoComplete="off"
          defaultValue={value.address}
          placeholder="Start typing your venue address…"
          className="w-full border rounded px-3 py-2"
        />
        <p className="text-xs text-stone-500">Powered by Google Places — pick a result for an exact location.</p>
      </div>

      <div
        ref={mapRef}
        className="w-full rounded-md border border-stone-200 bg-stone-100"
        style={{ height: 240 }}
      />

      {value.address && (
        <div className="text-xs text-stone-600 space-y-1">
          <div><b>Region:</b> {value.region || "—"}</div>
          {value.google_maps_url && (
            <div>
              <a href={value.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                ↗ Open on Google Maps
              </a>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-amber-700">{error}</p>}

      {/* Hidden fields so the form action receives all the address data. */}
      <input type="hidden" name={`${name ?? "address"}`}          value={value.address} />
      <input type="hidden" name={`${name ?? "address"}_region`}   value={value.region} />
      <input type="hidden" name={`${name ?? "address"}_lat`}      value={value.latitude ?? ""} />
      <input type="hidden" name={`${name ?? "address"}_lng`}      value={value.longitude ?? ""} />
      <input type="hidden" name={`${name ?? "address"}_place_id`} value={value.google_place_id ?? ""} />
      <input type="hidden" name={`${name ?? "address"}_maps_url`} value={value.google_maps_url ?? ""} />
    </div>
  );
}

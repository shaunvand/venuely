"use client";

import { useEffect, useRef, useState } from "react";

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
    _venuelyMapsBootstrap?: Promise<typeof google>;
  }
}

const SCRIPT_ID = "venuely-google-maps";

// Load Google Maps using the new async bootstrap loader. The script URL only
// bootstraps the namespace; we then use importLibrary() to actually pull in
// the Map + Places classes. Mixing `new google.maps.Map()` with `loading=async`
// is what previously broke with "Map is not a constructor".
function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("server"));
  if (window._venuelyMapsBootstrap) return window._venuelyMapsBootstrap;

  window._venuelyMapsBootstrap = new Promise((resolve, reject) => {
    // If the bootstrap script is already on the page from a prior mount, poll for the namespace.
    if (document.getElementById(SCRIPT_ID)) {
      const t0 = Date.now();
      const check = () => {
        if (window.google?.maps && typeof window.google.maps.importLibrary === "function") return resolve(window.google);
        if (Date.now() - t0 > 15000) return reject(new Error("Google Maps script loaded but namespace not ready"));
        setTimeout(check, 60);
      };
      check();
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    // v=weekly + loading=async + libraries=places.
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&v=weekly&callback=__venuelyMapsReady`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Could not load Google Maps. Check API key + referrer restrictions."));
    // Google calls this callback once the bootstrap is ready.
    (window as unknown as { __venuelyMapsReady: () => void }).__venuelyMapsReady = () => {
      if (window.google?.maps && typeof window.google.maps.importLibrary === "function") resolve(window.google);
      else reject(new Error("Google Maps callback fired but maps namespace missing"));
    };
    document.head.appendChild(s);
  });
  return window._venuelyMapsBootstrap;
}

function regionFromComponents(components: Array<{ long_name: string; types: string[] }>): string {
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

  useEffect(() => {
    if (!apiKey) {
      setError("Google Maps not configured — paste an address manually.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleMaps(apiKey);
        if (cancelled || !inputRef.current || !mapRef.current) return;
        // Pull in Map + Marker + Autocomplete + Geocoder via importLibrary (works with loading=async).
        const [{ Map }, { Marker }, { Autocomplete }, { Geocoder }] = await Promise.all([
          google.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
          google.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
          google.maps.importLibrary("places") as Promise<google.maps.PlacesLibrary>,
          google.maps.importLibrary("geocoding") as Promise<google.maps.GeocodingLibrary>,
        ]);
        if (cancelled) return;

        const startLat = value.latitude ?? -33.918861;  // Cape Town
        const startLng = value.longitude ?? 18.4233;
        mapInstance.current = new Map(mapRef.current, {
          center: { lat: startLat, lng: startLng },
          zoom: value.latitude ? 14 : 5,
          disableDefaultUI: true,
          zoomControl: true,
        });
        if (value.latitude && value.longitude) {
          markerInstance.current = new Marker({
            map: mapInstance.current,
            position: { lat: value.latitude, lng: value.longitude },
          });
        }

        // Apply a resolved location (from a picked prediction OR an auto-geocode):
        // update state + hidden fields, recenter the map and drop the pin.
        const applyResult = (next: AddressValue) => {
          setValue(next);
          onChange?.(next);
          if (next.latitude != null && next.longitude != null) {
            const pos = { lat: next.latitude, lng: next.longitude };
            if (mapInstance.current) {
              mapInstance.current.setCenter(pos);
              mapInstance.current.setZoom(15);
            }
            if (markerInstance.current) markerInstance.current.setMap(null);
            markerInstance.current = new Marker({ map: mapInstance.current!, position: pos });
          }
        };

        const ac = new Autocomplete(inputRef.current, {
          fields: ["formatted_address", "place_id", "geometry", "address_components", "url"],
          componentRestrictions: { country: ["za"] },
        });
        ac.bindTo("bounds", mapInstance.current);
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          const loc = place.geometry?.location;
          if (!loc || !place.place_id || !place.formatted_address) return;
          const region = place.address_components ? regionFromComponents(place.address_components) : "";
          const mapsUrl = place.url ?? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`;
          applyResult({
            address: place.formatted_address,
            region,
            latitude: loc.lat(),
            longitude: loc.lng(),
            google_place_id: place.place_id,
            google_maps_url: mapsUrl,
          });
        });

        // Auto-select the first Google result for a seeded address (e.g. pre-filled
        // from the venue's website) so the pin loads without the user having to click
        // into the field. They can still type to pick a different result afterwards.
        if (value.address && value.latitude == null && !value.google_place_id) {
          try {
            const geocoder = new Geocoder();
            const { results } = await geocoder.geocode({
              address: value.address,
              componentRestrictions: { country: "ZA" },
            });
            const r = results?.[0];
            const loc = r?.geometry?.location;
            if (!cancelled && r && loc && r.place_id && r.formatted_address) {
              if (inputRef.current) inputRef.current.value = r.formatted_address;
              applyResult({
                address: r.formatted_address,
                region: r.address_components ? regionFromComponents(r.address_components) : value.region,
                latitude: loc.lat(),
                longitude: loc.lng(),
                google_place_id: r.place_id,
                google_maps_url: `https://www.google.com/maps/place/?q=place_id:${r.place_id}`,
              });
            }
          } catch {
            // Geocode failed (ambiguous / no match) — leave the seed text for the user to pick manually.
          }
        }

        // Geolocation hint — only if no initial location.
        if (!value.latitude && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled || !mapInstance.current) return;
              mapInstance.current.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              mapInstance.current.setZoom(10);
            },
            () => {},
            { timeout: 4000, maximumAge: 60_000 }
          );
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
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
        <p className="text-xs text-stone-500">Powered by Google Places — we auto-locate from your details; start typing to pick a different result if the pin is off.</p>
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

      <input type="hidden" name={`${name ?? "address"}`}          value={value.address} />
      <input type="hidden" name={`${name ?? "address"}_region`}   value={value.region} />
      <input type="hidden" name={`${name ?? "address"}_lat`}      value={value.latitude ?? ""} />
      <input type="hidden" name={`${name ?? "address"}_lng`}      value={value.longitude ?? ""} />
      <input type="hidden" name={`${name ?? "address"}_place_id`} value={value.google_place_id ?? ""} />
      <input type="hidden" name={`${name ?? "address"}_maps_url`} value={value.google_maps_url ?? ""} />
    </div>
  );
}

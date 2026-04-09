"use client";

import { useRef, useEffect, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { Input } from "@/components/ui/Input";
import { hasGoogleMapsKey } from "@/components/maps/GoogleMapsProvider";

interface PlaceResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  mapUrl: string;
  googlePlaceId: string;
}

interface PlaceAutocompleteProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (result: PlaceResult) => void;
  disabled?: boolean;
  error?: string;
}

export default function PlaceAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  onPlaceSelect,
  disabled,
  error,
}: PlaceAutocompleteProps) {
  if (!hasGoogleMapsKey()) {
    return (
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        error={error}
      />
    );
  }

  return (
    <PlaceAutocompleteInner
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onPlaceSelect={onPlaceSelect}
      disabled={disabled}
      error={error}
    />
  );
}

function PlaceAutocompleteInner({
  label,
  placeholder,
  value,
  onChange,
  onPlaceSelect,
  disabled,
  error,
}: PlaceAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const places = useMapsLibrary("places");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!places || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new places.Autocomplete(inputRef.current, {
      fields: ["name", "formatted_address", "geometry", "formatted_phone_number", "place_id", "url"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;

      const result: PlaceResult = {
        name: place.name || "",
        address: place.formatted_address || "",
        latitude: place.geometry.location.lat(),
        longitude: place.geometry.location.lng(),
        phone: place.formatted_phone_number || "",
        mapUrl: place.url || "",
        googlePlaceId: place.place_id || "",
      };

      onPlaceSelect(result);
    });

    autocompleteRef.current = autocomplete;
    setReady(true);
  }, [places, onPlaceSelect]);

  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
            : "border-gray-300 focus:border-rose-500 focus:ring-rose-500/20"
        } ${disabled ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white"}`}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

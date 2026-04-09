"use client";

import { useState, useCallback } from "react";
import { Map, AdvancedMarker, InfoWindow, Pin } from "@vis.gl/react-google-maps";
import { useI18n } from "@/lib/i18n/context";
import type { NearbyPlace } from "@/types/database";
import type { TranslationKey } from "@/lib/i18n/translations";

const CATEGORY_COLORS: Record<string, { bg: string; glyph: string; border: string }> = {
  attraction: { bg: "#ef4444", glyph: "#ffffff", border: "#dc2626" },
  restaurant: { bg: "#f97316", glyph: "#ffffff", border: "#ea580c" },
  convenience: { bg: "#3b82f6", glyph: "#ffffff", border: "#2563eb" },
  experience: { bg: "#8b5cf6", glyph: "#ffffff", border: "#7c3aed" },
};

const CATEGORY_TRANSLATION_KEYS: Record<string, TranslationKey> = {
  attraction: "nearby.attraction",
  restaurant: "nearby.restaurant",
  convenience: "nearby.convenience",
  experience: "nearby.experience",
};

interface NearbyMapProps {
  places: NearbyPlace[];
  propertyLat?: number | null;
  propertyLng?: number | null;
  onPlaceInquiry?: (place: NearbyPlace) => void;
}

export default function NearbyMap({
  places,
  propertyLat,
  propertyLng,
  onPlaceInquiry,
}: NearbyMapProps) {
  const { t } = useI18n();
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);

  const placesWithCoords = places.filter(
    (p) => p.latitude != null && p.longitude != null
  );

  const centerLat = propertyLat ?? placesWithCoords[0]?.latitude ?? 37.5665;
  const centerLng = propertyLng ?? placesWithCoords[0]?.longitude ?? 126.978;

  const handleMarkerClick = useCallback((place: NearbyPlace) => {
    setSelectedPlace(place);
  }, []);

  return (
    <div className="h-full w-full">
      <Map
        defaultCenter={{ lat: centerLat, lng: centerLng }}
        defaultZoom={14}
        mapId="nearby-map"
        gestureHandling="greedy"
        disableDefaultUI={false}
        className="h-full w-full rounded-xl"
      >
        {/* Property marker */}
        {propertyLat != null && propertyLng != null && (
          <AdvancedMarker position={{ lat: propertyLat, lng: propertyLng }}>
            <Pin
              background="#e11d48"
              glyphColor="#ffffff"
              borderColor="#be123c"
              scale={1.2}
            />
          </AdvancedMarker>
        )}

        {/* Place markers */}
        {placesWithCoords.map((place) => {
          const colors = CATEGORY_COLORS[place.category] ?? CATEGORY_COLORS.attraction;
          return (
            <AdvancedMarker
              key={place.id}
              position={{ lat: place.latitude!, lng: place.longitude! }}
              onClick={() => handleMarkerClick(place)}
            >
              <Pin
                background={colors.bg}
                glyphColor={colors.glyph}
                borderColor={colors.border}
              />
            </AdvancedMarker>
          );
        })}

        {/* Info window for selected place */}
        {selectedPlace && selectedPlace.latitude != null && selectedPlace.longitude != null && (
          <InfoWindow
            position={{
              lat: selectedPlace.latitude,
              lng: selectedPlace.longitude,
            }}
            onCloseClick={() => setSelectedPlace(null)}
          >
            <div className="max-w-[200px] p-1">
              <h4 className="text-sm font-semibold text-gray-900">
                {selectedPlace.name}
              </h4>
              {selectedPlace.address && (
                <p className="mt-1 text-xs text-gray-500">
                  {selectedPlace.address}
                </p>
              )}
              <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {t(CATEGORY_TRANSLATION_KEYS[selectedPlace.category] ?? "nearby.attraction")}
              </span>
              {onPlaceInquiry && (
                <button
                  onClick={() => {
                    onPlaceInquiry(selectedPlace);
                    setSelectedPlace(null);
                  }}
                  className="mt-2 w-full rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-600"
                >
                  {t("placeInquiry.askHost")}
                </button>
              )}
            </div>
          </InfoWindow>
        )}
      </Map>
    </div>
  );
}

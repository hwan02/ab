"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import NearbyList from "@/components/nearby/NearbyList";
import PlaceRecommendForm from "@/components/nearby/PlaceRecommendForm";
import GoogleMapsProvider, { hasGoogleMapsKey } from "@/components/maps/GoogleMapsProvider";
import NearbyMap from "@/components/maps/NearbyMap";
import { Modal } from "@/components/ui/Modal";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { NearbyPlace, PlaceRecommendation } from "@/types/database";
import type { TranslationKey } from "@/lib/i18n/translations";

const CATEGORY_TRANSLATION_KEYS: Record<string, TranslationKey> = {
  attraction: "nearby.attraction",
  restaurant: "nearby.restaurant",
  convenience: "nearby.convenience",
  experience: "nearby.experience",
};

interface NearbyPageContentProps {
  places: NearbyPlace[] | null;
  recommendations?: PlaceRecommendation[] | null;
  propertyId: string;
  propertyLat?: number | null;
  propertyLng?: number | null;
}

export default function NearbyPageContent({
  places,
  recommendations,
  propertyId,
  propertyLat,
  propertyLng,
}: NearbyPageContentProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [showRecommendForm, setShowRecommendForm] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);
  const [inquiryPlace, setInquiryPlace] = useState<NearbyPlace | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const hasMap = hasGoogleMapsKey();
  const hasPlacesWithCoords = places?.some(
    (p) => p.latitude != null && p.longitude != null
  );

  const handlePlaceInquiry = useCallback((place: NearbyPlace) => {
    setInquiryPlace(place);
    setCustomMessage("");
    setShowCustomInput(false);
  }, []);

  function sendInquiry(intent: string) {
    if (!inquiryPlace) return;

    const payload = {
      placeName: inquiryPlace.name,
      placeCategory: inquiryPlace.category,
      placeAddress: inquiryPlace.address || "",
      intent,
    };

    const encoded = encodeURIComponent(JSON.stringify(payload));
    setInquiryPlace(null);
    router.push(`/property/${propertyId}/chat?placeInquiry=${encoded}`);
  }

  return (
    <GoogleMapsProvider>
      <div className="px-4 py-4">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {t("nearby.title")}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("nearby.subtitle")}
              </p>
            </div>

            {/* Map/List toggle */}
            {hasMap && hasPlacesWithCoords && places && places.length > 0 && (
              <div className="flex rounded-lg bg-gray-100 p-0.5">
                <button
                  onClick={() => setViewMode("list")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t("map.listView")}
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "map"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t("map.mapView")}
                </button>
              </div>
            )}
          </div>
        </div>

        {!places || places.length === 0 ? (
          <EmptyState
            title={t("nearby.noPlaces")}
            description={t("nearby.noPlacesGuestDesc")}
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
                />
              </svg>
            }
          />
        ) : viewMode === "map" ? (
          <div className="h-[60vh] overflow-hidden rounded-xl border border-gray-200">
            <NearbyMap
              places={places}
              propertyLat={propertyLat}
              propertyLng={propertyLng}
              onPlaceInquiry={handlePlaceInquiry}
            />
          </div>
        ) : (
          <NearbyList places={places} recommendations={recommendations} onPlaceInquiry={handlePlaceInquiry} />
        )}

        {/* Recommend a place */}
        <div className="mt-6">
          {showRecommendForm ? (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">{t("recommend.title")}</h3>
                <button
                  onClick={() => setShowRecommendForm(false)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <PlaceRecommendForm propertyId={propertyId} onClose={() => setShowRecommendForm(false)} />
            </Card>
          ) : (
            <button
              onClick={() => {
                if (!isLoggedIn) { router.push("/login"); return; }
                setShowRecommendForm(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 py-4 text-sm font-medium text-gray-500 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {t("recommend.title")}
            </button>
          )}
        </div>

        {/* Intent Selection Modal */}
        <Modal
          open={!!inquiryPlace}
          onClose={() => setInquiryPlace(null)}
          title={t("placeInquiry.selectIntent")}
        >
          {inquiryPlace && (
            <div className="space-y-3">
              {/* Place info summary */}
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm font-semibold text-gray-900">
                  {inquiryPlace.name}
                </p>
                <p className="text-xs text-gray-500">
                  {t(CATEGORY_TRANSLATION_KEYS[inquiryPlace.category] ?? "nearby.attraction")}
                  {inquiryPlace.address ? ` · ${inquiryPlace.address}` : ""}
                </p>
              </div>

              {/* Intent options */}
              <div className="space-y-2">
                <button
                  onClick={() => sendInquiry(t("placeInquiry.wantToVisit"))}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:border-rose-300 hover:bg-rose-50"
                >
                  {t("placeInquiry.wantToVisit")}
                </button>
                <button
                  onClick={() => sendInquiry(t("placeInquiry.wantToBook"))}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:border-rose-300 hover:bg-rose-50"
                >
                  {t("placeInquiry.wantToBook")}
                </button>
                <button
                  onClick={() => sendInquiry(t("placeInquiry.wantToKnow"))}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:border-rose-300 hover:bg-rose-50"
                >
                  {t("placeInquiry.wantToKnow")}
                </button>

                {/* Custom input */}
                {showCustomInput ? (
                  <div className="space-y-2">
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder={t("placeInquiry.customPlaceholder")}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                    <Button
                      onClick={() => {
                        if (customMessage.trim()) sendInquiry(customMessage.trim());
                      }}
                      disabled={!customMessage.trim()}
                      size="sm"
                      className="w-full"
                    >
                      {t("placeInquiry.sendToChat")}
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCustomInput(true)}
                    className="w-full rounded-lg border border-dashed border-gray-300 px-4 py-3 text-left text-sm text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-50"
                  >
                    {t("placeInquiry.custom")}
                  </button>
                )}
              </div>
            </div>
          )}
        </Modal>
      </div>
    </GoogleMapsProvider>
  );
}

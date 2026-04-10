"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { NearbyPlace, PlaceRecommendation } from "@/types/database";
import type { TranslationKey } from "@/lib/i18n/translations";

interface NearbyListProps {
  places: NearbyPlace[];
  recommendations?: PlaceRecommendation[] | null;
  onPlaceInquiry?: (place: NearbyPlace) => void;
}

const CATEGORY_KEYS: { key: string; translationKey: TranslationKey }[] = [
  { key: "all", translationKey: "nearby.all" },
  { key: "attraction", translationKey: "nearby.attraction" },
  { key: "restaurant", translationKey: "nearby.restaurant" },
  { key: "convenience", translationKey: "nearby.convenience" },
  { key: "experience", translationKey: "nearby.experience" },
];

type CategoryFilter = "all" | "attraction" | "restaurant" | "convenience" | "experience";

export default function NearbyList({ places, recommendations, onPlaceInquiry }: NearbyListProps) {
  const { t } = useI18n();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  const filteredPlaces =
    activeCategory === "all"
      ? places
      : places.filter((p) => p.category === activeCategory);

  function getCategoryLabel(category: string): string {
    const found = CATEGORY_KEYS.find((c) => c.key === category);
    return found ? t(found.translationKey) : category;
  }

  return (
    <div>
      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORY_KEYS.map((cat) => {
          const count =
            cat.key === "all"
              ? places.length
              : places.filter((p) => p.category === cat.key).length;

          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key as CategoryFilter)}
              className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === cat.key
                  ? "bg-rose-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t(cat.translationKey)}
              {count > 0 && (
                <span
                  className={`ml-1.5 ${
                    activeCategory === cat.key
                      ? "text-rose-100"
                      : "text-gray-400"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Places List */}
      <div className="mt-4 space-y-3">
        {filteredPlaces.length === 0 ? (
          <EmptyState
            title={t("nearby.noPlaces")}
            description={t("nearby.noPlacesFilterDesc")}
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
                  d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                />
              </svg>
            }
          />
        ) : (
          <>
            {filteredPlaces.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                getCategoryLabel={getCategoryLabel}
                onPlaceInquiry={onPlaceInquiry}
              />
            ))}
            {/* Guest recommended places */}
            {recommendations && recommendations
              .filter((r) => activeCategory === "all" || r.category === activeCategory)
              .map((rec) => (
                <RecommendedPlaceCard key={rec.id} rec={rec} getCategoryLabel={getCategoryLabel} />
              ))}
          </>
        )}
      </div>
    </div>
  );
}

function PlaceCard({
  place,
  getCategoryLabel,
  onPlaceInquiry,
}: {
  place: NearbyPlace;
  getCategoryLabel: (cat: string) => string;
  onPlaceInquiry?: (place: NearbyPlace) => void;
}) {
  const { t } = useI18n();
  const categoryLabel = getCategoryLabel(place.category);

  return (
    <Card className="p-4">
      <div className="flex gap-3">
        {place.photo_url && (
          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
            <Image
              src={place.photo_url}
              alt={place.name}
              fill
              className="object-cover"
              sizes="80px"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900">
              {place.name}
            </h3>
            {categoryLabel && (
              <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {categoryLabel}
              </span>
            )}
          </div>
          {place.description && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-500">
              {place.description}
            </p>
          )}
          {place.address && (
            <AddressRow address={place.address} name={place.name} />
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-3 flex gap-2">
        {(place.map_url || place.address) && (
          <a
            href={place.map_url || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.address || place.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z"
                clipRule="evenodd"
              />
            </svg>
            {t("nearby.viewMap")}
          </a>
        )}
        {onPlaceInquiry && (
          <button
            onClick={() => onPlaceInquiry(place)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
              />
            </svg>
            {t("placeInquiry.askHost")}
          </button>
        )}
        {!onPlaceInquiry && place.phone && (
          <a
            href={`tel:${place.phone}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
            {t("nearby.call")}
          </a>
        )}
      </div>
    </Card>
  );
}

function AddressRow({ address, name }: { address: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [address]);

  return (
    <div className="mt-1 flex items-center gap-1">
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-rose-500 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
        </svg>
        <span className="underline-offset-2 hover:underline">{address}</span>
      </a>
      <button
        onClick={handleCopy}
        className="shrink-0 rounded p-0.5 text-gray-300 transition-colors hover:text-gray-500"
        title={t("property.copyLabel")}
      >
        {copied ? (
          <svg className="h-3 w-3 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
          </svg>
        )}
      </button>
    </div>
  );
}

function RecommendedPlaceCard({
  rec,
  getCategoryLabel,
}: {
  rec: PlaceRecommendation;
  getCategoryLabel: (cat: string) => string;
}) {
  const { t } = useI18n();

  return (
    <Card className="border-rose-100 bg-rose-50/30 p-4">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-gray-900">
            {rec.name}
          </h3>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-600">
              {t("recommend.guestPick")}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {getCategoryLabel(rec.category)}
            </span>
          </div>
        </div>
        {rec.description && (
          <p className="mt-1 line-clamp-2 text-sm text-gray-500">
            {rec.description}
          </p>
        )}
        {rec.address && (
          <AddressRow address={rec.address} name={rec.name} />
        )}

        {/* Recommender info */}
        {rec.show_recommender && rec.recommender_name && (
          <div className="mt-2 flex items-center gap-2">
            {rec.recommender_avatar ? (
              <img
                src={rec.recommender_avatar}
                alt=""
                className="h-5 w-5 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-200 text-[10px] font-semibold text-rose-600">
                {rec.recommender_name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-xs text-gray-500">
              {rec.recommender_name}
            </span>
            {rec.recommender_country && (
              <span className="text-xs text-gray-400">
                {rec.recommender_country}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Map button */}
      {rec.address && (
        <div className="mt-3">
          <a
            href={rec.map_url || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(rec.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clipRule="evenodd" />
            </svg>
            {t("nearby.viewMap")}
          </a>
        </div>
      )}
    </Card>
  );
}

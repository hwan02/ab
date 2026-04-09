"use client";

import { useState } from "react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { NearbyPlace } from "@/types/database";
import type { TranslationKey } from "@/lib/i18n/translations";

interface NearbyListProps {
  places: NearbyPlace[];
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

export default function NearbyList({ places, onPlaceInquiry }: NearbyListProps) {
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
          filteredPlaces.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              getCategoryLabel={getCategoryLabel}
              onPlaceInquiry={onPlaceInquiry}
            />
          ))
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
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                />
              </svg>
              {place.address}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-3 flex gap-2">
        {place.map_url && (
          <a
            href={place.map_url}
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

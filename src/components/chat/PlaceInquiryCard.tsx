"use client";

import { Card } from "@/components/ui/Card";
import type { TranslationKey } from "@/lib/i18n/translations";

interface PlaceInquiryCardProps {
  content: string;
  t: (key: TranslationKey) => string;
}

const CATEGORY_TRANSLATION_KEYS: Record<string, TranslationKey> = {
  attraction: "nearby.attraction",
  restaurant: "nearby.restaurant",
  convenience: "nearby.convenience",
  experience: "nearby.experience",
};

export default function PlaceInquiryCard({ content, t }: PlaceInquiryCardProps) {
  try {
    const data = JSON.parse(content);
    const categoryKey = CATEGORY_TRANSLATION_KEYS[data.placeCategory];

    return (
      <Card className="max-w-xs border-emerald-200 bg-emerald-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-sm">
            📍
          </span>
          <span className="text-sm font-semibold text-emerald-800">
            {t("placeInquiry.title")}
          </span>
        </div>
        <div className="space-y-1 text-sm text-gray-700">
          <p>
            <span className="font-medium">{t("placeInquiry.place")}</span>{" "}
            {data.placeName}
          </p>
          {categoryKey && (
            <p>
              <span className="font-medium">{t("placeInquiry.category")}</span>{" "}
              {t(categoryKey)}
            </p>
          )}
          {data.placeAddress && (
            <p>
              <span className="font-medium">{t("placeInquiry.address")}</span>{" "}
              {data.placeAddress}
            </p>
          )}
          <p className="mt-1 rounded-md bg-emerald-100/60 px-2 py-1.5 text-sm text-emerald-800">
            <span className="font-medium">{t("placeInquiry.request")}</span>{" "}
            {data.intent}
          </p>
        </div>
      </Card>
    );
  } catch {
    return <p className="text-sm">{content}</p>;
  }
}

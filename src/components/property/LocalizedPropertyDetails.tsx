"use client";

import { useI18n } from "@/lib/i18n/context";
import { lp, hasDbTranslation } from "@/lib/i18n/localize";
import AutoTranslate from "@/components/i18n/AutoTranslate";
import type { Property } from "@/types/database";

interface LocalizedPropertyDetailsProps {
  property: Property;
}

export default function LocalizedPropertyDetails({
  property,
}: LocalizedPropertyDetailsProps) {
  const { locale } = useI18n();
  const name = lp(property, "name", locale);
  const address = lp(property, "address", locale);
  const description = lp(property, "description", locale);
  const descFromDb = hasDbTranslation(property, "description", locale);

  return (
    <>
      <div className="mt-4">
        <h2 className="text-xl font-bold text-gray-900">{name}</h2>
        {address && (
          <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 flex-shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            {address}
          </p>
        )}
      </div>

      {description && (
        <div className="mt-4 rounded-xl bg-white p-4 border border-gray-200">
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
            {descFromDb ? description : <AutoTranslate text={description} />}
          </div>
        </div>
      )}
    </>
  );
}

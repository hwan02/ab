"use client";

import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { EmergencyContact } from "@/types/database";
import type { TranslationKey } from "@/lib/i18n/translations";

interface EmergencyPageContentProps {
  contacts: EmergencyContact[] | null;
}

const CATEGORY_CONFIG: Record<
  EmergencyContact["category"],
  { labelKey: TranslationKey; bgColor: string; textColor: string; iconPath: string }
> = {
  hospital: {
    labelKey: "category.hospital",
    bgColor: "bg-red-50",
    textColor: "text-red-500",
    iconPath:
      "M4.5 12.75l6 6 9-13.5",
  },
  police: {
    labelKey: "category.police",
    bgColor: "bg-blue-50",
    textColor: "text-blue-500",
    iconPath:
      "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
  },
  fire: {
    labelKey: "category.fire",
    bgColor: "bg-orange-50",
    textColor: "text-orange-500",
    iconPath:
      "M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z",
  },
  host: {
    labelKey: "category.host",
    bgColor: "bg-rose-50",
    textColor: "text-rose-500",
    iconPath:
      "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  },
  other: {
    labelKey: "category.other",
    bgColor: "bg-gray-50",
    textColor: "text-gray-500",
    iconPath:
      "M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z",
  },
};

const CATEGORY_ORDER: EmergencyContact["category"][] = [
  "hospital",
  "police",
  "fire",
  "host",
  "other",
];

function QuickDialButton({
  number,
  label,
  color,
}: {
  number: string;
  label: string;
  color: string;
}) {
  return (
    <a
      href={`tel:${number}`}
      className={`flex flex-col items-center gap-1 rounded-xl ${color} px-3 py-3 text-white transition-opacity hover:opacity-90`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
      </svg>
      <span className="text-lg font-bold">{number}</span>
      <span className="text-xs">{label}</span>
    </a>
  );
}

export default function EmergencyPageContent({
  contacts,
}: EmergencyPageContentProps) {
  const { t } = useI18n();

  const groupedContacts = CATEGORY_ORDER.reduce(
    (acc, category) => {
      const categoryContacts = (contacts ?? []).filter(
        (c) => c.category === category
      );
      if (categoryContacts.length > 0) {
        acc.push({ category, contacts: categoryContacts });
      }
      return acc;
    },
    [] as { category: EmergencyContact["category"]; contacts: EmergencyContact[] }[]
  );

  return (
    <div className="px-4 py-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          {t("emergency.title")}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {t("emergency.subtitle")}
        </p>
      </div>

      {/* Quick Dial */}
      <div className="mb-6 grid grid-cols-3 gap-2">
        <QuickDialButton number="119" label={t("emergency.fire")} color="bg-red-500" />
        <QuickDialButton number="112" label={t("emergency.police")} color="bg-blue-500" />
        <QuickDialButton number="1339" label={t("emergency.medical")} color="bg-green-500" />
      </div>

      {groupedContacts.length === 0 ? (
        <EmptyState
          title={t("emergency.noContacts")}
          description={t("emergency.noContactsGuestDesc")}
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
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
              />
            </svg>
          }
        />
      ) : (
        <div className="space-y-6">
          {groupedContacts.map(({ category, contacts: categoryContacts }) => {
            const config = CATEGORY_CONFIG[category];
            return (
              <section key={category}>
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${config.bgColor}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-4 w-4 ${config.textColor}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={config.iconPath}
                      />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {t(config.labelKey)}
                  </h3>
                </div>
                <div className="space-y-2">
                  {categoryContacts.map((contact) => (
                    <Card key={contact.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {contact.name}
                          </p>
                          {contact.address && (
                            <p className="mt-0.5 truncate text-xs text-gray-400">
                              {contact.address}
                            </p>
                          )}
                        </div>
                        <a
                          href={`tel:${contact.phone}`}
                          className={`ml-3 flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors ${
                            category === "hospital"
                              ? "bg-red-500 hover:bg-red-600"
                              : category === "police"
                                ? "bg-blue-500 hover:bg-blue-600"
                                : category === "fire"
                                  ? "bg-orange-500 hover:bg-orange-600"
                                  : category === "host"
                                    ? "bg-rose-500 hover:bg-rose-600"
                                    : "bg-gray-500 hover:bg-gray-600"
                          }`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                          </svg>
                          {contact.phone}
                        </a>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

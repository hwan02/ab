"use client";

import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";
import type { Announcement } from "@/types/database";

interface AnnouncementsPageContentProps {
  announcements: Announcement[] | null;
}

export default function AnnouncementsPageContent({
  announcements,
}: AnnouncementsPageContentProps) {
  const { t } = useI18n();

  return (
    <div className="px-4 py-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          {t("announcements.title")}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {t("announcements.guestSubtitle")}
        </p>
      </div>

      {!announcements || announcements.length === 0 ? (
        <EmptyState
          title={t("announcements.noAnnouncements")}
          description={t("announcements.noAnnouncementsGuestDesc")}
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
                d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46"
              />
            </svg>
          }
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <Card key={announcement.id} className="p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-900">
                  {announcement.title}
                </h3>
                <span className="flex-shrink-0 text-xs text-gray-400">
                  {formatDate(announcement.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                {announcement.content}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

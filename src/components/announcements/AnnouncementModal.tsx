"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import type { Announcement } from "@/types/database";

interface AnnouncementModalProps {
  propertyId: string;
}

export default function AnnouncementModal({ propertyId }: AnnouncementModalProps) {
  const { t } = useI18n();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check "don't show today" preference
    const dismissKey = `announcement_dismiss_${propertyId}`;
    const dismissed = localStorage.getItem(dismissKey);
    if (dismissed) {
      const dismissDate = new Date(dismissed).toDateString();
      const today = new Date().toDateString();
      if (dismissDate === today) return;
    }

    const fetchAnnouncements = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (data && data.length > 0) {
        setAnnouncements(data);
        setVisible(true);
      }
    };
    fetchAnnouncements();
  }, [propertyId]);

  const handleClose = () => {
    setVisible(false);
  };

  const handleDismissToday = () => {
    const dismissKey = `announcement_dismiss_${propertyId}`;
    localStorage.setItem(dismissKey, new Date().toISOString());
    setVisible(false);
  };

  if (!visible || announcements.length === 0) return null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
            </svg>
            <h2 className="text-base font-bold text-gray-900">
              {t("announcements.title")}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-80 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            {announcements.map((ann) => (
              <div key={ann.id}>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{ann.title}</h3>
                  <span className="text-xs text-gray-400">{formatDate(ann.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                  {ann.content}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
          <button
            onClick={handleDismissToday}
            className="text-xs text-gray-400 transition-colors hover:text-gray-600"
          >
            {t("announcements.dismissToday")}
          </button>
          <button
            onClick={handleClose}
            className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-rose-600"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

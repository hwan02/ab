"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n/context";
import { lp } from "@/lib/i18n/localize";
import AutoTranslate from "@/components/i18n/AutoTranslate";
import type { PropertyGuide } from "@/types/database";

interface PropertyGuideSectionProps {
  guides: PropertyGuide[];
}

const CATEGORY_ORDER = ["appliance", "directions", "facility", "other"] as const;

export default function PropertyGuideSection({ guides }: PropertyGuideSectionProps) {
  const { t, locale } = useI18n();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const categoryLabels: Record<string, string> = {
    appliance: t("guide.appliance"),
    directions: t("guide.directions"),
    facility: t("guide.facility"),
    other: t("guide.other"),
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    appliance: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
    directions: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0 0-3-3m3 3 3-3m-3-6a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z" />
      </svg>
    ),
    facility: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
      </svg>
    ),
    other: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
      </svg>
    ),
  };

  // Group guides by category
  const grouped = CATEGORY_ORDER.reduce(
    (acc, cat) => {
      const items = guides.filter((g) => g.category === cat);
      if (items.length > 0) acc[cat] = items;
      return acc;
    },
    {} as Record<string, PropertyGuide[]>
  );

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <div className="text-gray-500">{categoryIcons[category]}</div>
            <span className="text-sm font-semibold text-gray-800">
              {categoryLabels[category]}
            </span>
            <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {items.length}
            </span>
          </div>

          <div className="border-t border-gray-100">
            {items.map((guide) => {
              const isExpanded = expandedId === guide.id;
              return (
                <div key={guide.id} className="border-b border-gray-50 last:border-b-0">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : guide.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                  >
                    <span className="min-w-0 flex-1 text-sm font-medium text-gray-700">
                      <AutoTranslate text={guide.title} />
                    </span>
                    <svg
                      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4">
                      {guide.content && (
                        <p className="mb-3 whitespace-pre-wrap text-sm text-gray-600">
                          <AutoTranslate text={guide.content} />
                        </p>
                      )}
                      {guide.video_url && (
                        <YouTubeEmbed url={guide.video_url} />
                      )}
                      {(() => {
                        const mediaUrl = lp(guide, "media_url", locale) || null;
                        const mediaType = lp(guide, "media_type", locale) || null;
                        if (!mediaUrl) return null;
                        return (
                          <div className="overflow-hidden rounded-lg">
                            {mediaType === "video" ? (
                              <LazyVideo src={mediaUrl} />
                            ) : (
                              <button
                                onClick={() => setViewingImage(mediaUrl)}
                                className="w-full"
                              >
                                <img
                                  src={mediaUrl}
                                  alt={guide.title}
                                  className="w-full rounded-lg object-cover"
                                />
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Image Fullscreen Viewer */}
      {viewingImage && (
        <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />
      )}
    </div>
  );
}

function extractYouTubeId(url: string): string | null {
  const match =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return match ? match[1] : null;
}

function YouTubeEmbed({ url }: { url: string }) {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-3 flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2.5 text-sm text-blue-600 hover:bg-gray-200"
      >
        <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        {url}
      </a>
    );
  }

  return (
    <div className="mb-3 overflow-hidden rounded-lg">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function LazyVideo({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const { t } = useI18n();

  if (playing) {
    return (
      <video
        src={src}
        controls
        autoPlay
        playsInline
        className="w-full rounded-lg"
      />
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="relative flex w-full items-center justify-center rounded-lg bg-gray-900 py-8"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
          <svg className="ml-1 h-7 w-7 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="text-sm font-medium text-white/80">
          {t("guide.playVideo")}
        </span>
      </div>
    </button>
  );
}

function ImageViewer({ src, onClose }: { src: string; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white/80 hover:bg-black/60 hover:text-white"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
      <img
        src={src}
        alt=""
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

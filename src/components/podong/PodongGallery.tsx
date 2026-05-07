"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import PodongPhotoModal from "./PodongPhotoModal";
import type { PodongPhoto } from "@/types/database";

interface PodongGalleryProps {
  photos: PodongPhoto[];
}

export default function PodongGallery({ photos }: PodongGalleryProps) {
  const { t } = useI18n();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-gray-50 py-16">
        <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
        </svg>
        <p className="mt-3 text-sm text-gray-500">{t("podong.noPhotosGuestDesc")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            onClick={() => setSelectedIndex(index)}
            className="group relative aspect-square overflow-hidden rounded-xl"
          >
            <img
              src={photo.photo_url}
              alt={photo.caption || "Podong"}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
            {photo.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2.5 pt-6">
                <p className="text-xs font-medium text-white line-clamp-2">{photo.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedIndex !== null && (
        <PodongPhotoModal
          photos={photos}
          initialIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </>
  );
}

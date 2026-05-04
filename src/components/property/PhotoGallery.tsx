"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n/context";

interface PhotoGalleryProps {
  photos: string[];
}

export default function PhotoGallery({ photos }: PhotoGalleryProps) {
  const { t } = useI18n();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!photos || photos.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl bg-gray-100">
        <div className="text-center text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto h-10 w-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
            />
          </svg>
          <p className="mt-2 text-sm">{t("photo.noPhotos")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero: single cover photo */}
      <button
        onClick={() => setSelectedIndex(0)}
        className="relative h-56 w-full overflow-hidden rounded-xl"
      >
        <img
          src={photos[0]}
          alt={t("photo.propertyPhoto")}
          className="h-full w-full object-cover transition-transform hover:scale-105"
        />
        {photos.length > 1 && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
            {photos.length}
          </div>
        )}
      </button>

      {/* Fullscreen photo viewer */}
      {selectedIndex !== null && (
        <FullscreenViewer
          photos={photos}
          currentIndex={selectedIndex}
          onChangeIndex={setSelectedIndex}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </>
  );
}

function FullscreenViewer({
  photos,
  currentIndex,
  onChangeIndex,
  onClose,
}: {
  photos: string[];
  currentIndex: number;
  onChangeIndex: (i: number) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  const handlePrev = useCallback(() => {
    onChangeIndex(currentIndex > 0 ? currentIndex - 1 : photos.length - 1);
  }, [currentIndex, photos.length, onChangeIndex]);

  const handleNext = useCallback(() => {
    onChangeIndex(currentIndex < photos.length - 1 ? currentIndex + 1 : 0);
  }, [currentIndex, photos.length, onChangeIndex]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose, handlePrev, handleNext]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium text-white/70">
          {currentIndex + 1} / {photos.length}
        </span>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Image area */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        <img
          src={photos[currentIndex]}
          alt={`${t("photo.propertyPhoto")} ${currentIndex + 1}`}
          className="h-full w-full object-contain"
        />

        {/* Prev / Next overlays */}
        {photos.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
              aria-label={t("photo.previousPhoto")}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
              aria-label={t("photo.nextPhoto")}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

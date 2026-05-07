"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n/context";
import PodongCommentSection from "./PodongCommentSection";
import type { PodongPhoto } from "@/types/database";

interface PodongPhotoModalProps {
  photos: PodongPhoto[];
  initialIndex: number;
  onClose: () => void;
}

export default function PodongPhotoModal({ photos, initialIndex, onClose }: PodongPhotoModalProps) {
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handlePrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : photos.length - 1));
  }, [photos.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((i) => (i < photos.length - 1 ? i + 1 : 0));
  }, [photos.length]);

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

  const currentPhoto = photos[currentIndex];

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
          src={currentPhoto.photo_url}
          alt={currentPhoto.caption || "Podong"}
          className="max-h-full max-w-full object-contain"
        />

        {photos.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Caption */}
      {currentPhoto.caption && (
        <div className="px-4 py-2 text-center text-sm text-white/80">
          {currentPhoto.caption}
        </div>
      )}

      {/* Comments section */}
      <div className="max-h-[40vh] overflow-y-auto rounded-t-2xl bg-white px-4 py-4">
        <PodongCommentSection photoId={currentPhoto.id} />
      </div>
    </div>,
    document.body
  );
}

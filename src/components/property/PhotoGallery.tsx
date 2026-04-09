"use client";

import { useState } from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
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
      {photos.length === 1 ? (
        <button
          onClick={() => setSelectedIndex(0)}
          className="relative h-56 w-full overflow-hidden rounded-xl"
        >
          <Image
            src={photos[0]}
            alt={t("photo.propertyPhoto")}
            fill
            className="object-cover transition-transform hover:scale-105"
            sizes="(max-width: 640px) 100vw, 640px"
          />
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((photo, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={`relative overflow-hidden rounded-xl ${
                index === 0 && photos.length > 2
                  ? "col-span-2 h-48"
                  : "h-32"
              }`}
            >
              <Image
                src={photo}
                alt={`${t("photo.propertyPhoto")} ${index + 1}`}
                fill
                className="object-cover transition-transform hover:scale-105"
                sizes="(max-width: 640px) 50vw, 320px"
              />
              {index === 3 && photos.length > 4 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="text-lg font-semibold text-white">
                    +{photos.length - 4}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Full-size modal */}
      <Modal
        open={selectedIndex !== null}
        onClose={() => setSelectedIndex(null)}
        className="max-w-3xl"
      >
        {selectedIndex !== null && (
          <div className="relative">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg">
              <Image
                src={photos[selectedIndex]}
                alt={`${t("photo.propertyPhoto")} ${selectedIndex + 1}`}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 768px"
              />
            </div>

            {/* Navigation */}
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() =>
                  setSelectedIndex(
                    selectedIndex > 0 ? selectedIndex - 1 : photos.length - 1
                  )
                }
                className="rounded-lg bg-gray-100 p-2 text-gray-600 transition-colors hover:bg-gray-200"
                aria-label={t("photo.previousPhoto")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <span className="text-sm text-gray-500">
                {selectedIndex + 1} / {photos.length}
              </span>
              <button
                onClick={() =>
                  setSelectedIndex(
                    selectedIndex < photos.length - 1 ? selectedIndex + 1 : 0
                  )
                }
                className="rounded-lg bg-gray-100 p-2 text-gray-600 transition-colors hover:bg-gray-200"
                aria-label={t("photo.nextPhoto")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

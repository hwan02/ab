"use client";

import { useState } from "react";
import type { Message } from "@/types/database";
import { useI18n } from "@/lib/i18n/context";
import type { TranslationKey } from "@/lib/i18n/translations";
import { formatFileSize } from "@/lib/imageCompression";
import { Card } from "@/components/ui/Card";
import PlaceInquiryCard from "@/components/chat/PlaceInquiryCard";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

const LOCALE_MAP: Record<string, string> = {
  ko: "ko-KR",
  en: "en-US",
  ja: "ja-JP",
  zh: "zh-CN",
};

function formatTime(dateString: string, dateLocale: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString(dateLocale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ItemRequestCard({ content, t }: { content: string; t: (key: TranslationKey) => string }) {
  try {
    const data = JSON.parse(content);
    return (
      <Card className="max-w-xs border-amber-200 bg-amber-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg">📦</span>
          <span className="text-sm font-semibold text-amber-800">
            {t("message.itemRequest")}
          </span>
        </div>
        <div className="space-y-1 text-sm text-gray-700">
          <p>
            <span className="font-medium">{t("message.item")}</span> {data.itemName}
          </p>
          <p>
            <span className="font-medium">{t("message.quantity")}</span> {data.quantity}
          </p>
          <p>
            <span className="font-medium">{t("message.urgency")}</span>{" "}
            <span
              className={
                data.urgency === "급함"
                  ? "font-semibold text-red-600"
                  : "text-gray-600"
              }
            >
              {data.urgency}
            </span>
          </p>
          {data.notes && (
            <p>
              <span className="font-medium">{t("message.notes")}</span> {data.notes}
            </p>
          )}
        </div>
      </Card>
    );
  } catch {
    return <p className="text-sm">{content}</p>;
  }
}

function ReservationRequestCard({ content, t }: { content: string; t: (key: TranslationKey) => string }) {
  try {
    const data = JSON.parse(content);
    return (
      <Card className="max-w-xs border-blue-200 bg-blue-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg">🍽️</span>
          <span className="text-sm font-semibold text-blue-800">
            {t("message.reservationRequest")}
          </span>
        </div>
        <div className="space-y-1 text-sm text-gray-700">
          <p>
            <span className="font-medium">{t("message.restaurant")}</span>{" "}
            {data.restaurantName}
          </p>
          {data.address && (
            <p className="text-xs text-gray-500">{data.address}</p>
          )}
          <p>
            <span className="font-medium">{t("message.date")}</span> {data.date}
          </p>
          <p>
            <span className="font-medium">{t("message.time")}</span> {data.time}
          </p>
          <p>
            <span className="font-medium">{t("message.partySize")}</span> {data.partySize}{t("message.peopleSuffix")}
          </p>
          {data.phone && (
            <p>
              <span className="font-medium">{t("message.phone")}</span>{" "}
              <a href={`tel:${data.phone}`} className="text-blue-600 underline">{data.phone}</a>
            </p>
          )}
          {data.specialRequests && (
            <p>
              <span className="font-medium">{t("message.specialRequests")}</span>{" "}
              {data.specialRequests}
            </p>
          )}
          {data.mapUrl && (
            <a
              href={data.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            >
              📍 {t("message.viewMap")}
            </a>
          )}
        </div>
      </Card>
    );
  } catch {
    return <p className="text-sm">{content}</p>;
  }
}

function ImageMessageCard({ content, isOwn }: { content: string; isOwn: boolean }) {
  const [expanded, setExpanded] = useState(false);

  try {
    const data = JSON.parse(content);
    return (
      <>
        <div
          className={`max-w-[260px] cursor-pointer overflow-hidden rounded-2xl ${
            isOwn ? "rounded-br-md" : "rounded-bl-md"
          }`}
          onClick={() => setExpanded(true)}
        >
          <img
            src={data.url}
            alt={data.fileName || "Image"}
            className="h-auto w-full object-cover"
            loading="lazy"
          />
        </div>
        {data.fileName && (
          <span className="mt-0.5 text-xs text-gray-400">
            {data.fileName}
            {data.fileSize ? ` (${formatFileSize(data.fileSize)})` : ""}
          </span>
        )}

        {/* Fullscreen lightbox */}
        {expanded && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setExpanded(false)}
          >
            <button
              className="absolute right-4 top-4 text-2xl text-white/80 hover:text-white"
              onClick={() => setExpanded(false)}
            >
              ✕
            </button>
            <img
              src={data.url}
              alt={data.fileName || "Image"}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            />
          </div>
        )}
      </>
    );
  } catch {
    return <p className="text-sm">{content}</p>;
  }
}

function FileMessageCard({ content }: { content: string }) {
  try {
    const data = JSON.parse(content);
    const ext = data.fileName?.split(".").pop()?.toUpperCase() || "FILE";

    return (
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <Card className="flex max-w-[260px] items-center gap-3 border-gray-200 bg-white p-3 transition-colors hover:bg-gray-50">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-xs font-bold text-rose-600">
            {ext}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {data.fileName || "File"}
            </p>
            {data.fileSize && (
              <p className="text-xs text-gray-500">{formatFileSize(data.fileSize)}</p>
            )}
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5 shrink-0 text-gray-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
        </Card>
      </a>
    );
  } catch {
    return <p className="text-sm">{content}</p>;
  }
}

function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const { t, locale } = useI18n();
  const dateLocale = LOCALE_MAP[locale] || "ko-KR";

  if (message.message_type === "item_request") {
    return (
      <div
        className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3 px-2`}
      >
        <div className="flex flex-col gap-1">
          <ItemRequestCard content={message.content} t={t} />
          <span
            className={`text-xs text-gray-400 ${isOwn ? "text-right" : "text-left"}`}
          >
            {formatTime(message.created_at, dateLocale)}
          </span>
        </div>
      </div>
    );
  }

  if (message.message_type === "reservation_request") {
    return (
      <div
        className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3 px-2`}
      >
        <div className="flex flex-col gap-1">
          <ReservationRequestCard content={message.content} t={t} />
          <span
            className={`text-xs text-gray-400 ${isOwn ? "text-right" : "text-left"}`}
          >
            {formatTime(message.created_at, dateLocale)}
          </span>
        </div>
      </div>
    );
  }

  if (message.message_type === "place_inquiry") {
    return (
      <div
        className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3 px-2`}
      >
        <div className="flex flex-col gap-1">
          <PlaceInquiryCard content={message.content} t={t} />
          <span
            className={`text-xs text-gray-400 ${isOwn ? "text-right" : "text-left"}`}
          >
            {formatTime(message.created_at, dateLocale)}
          </span>
        </div>
      </div>
    );
  }

  if (message.message_type === "image") {
    return (
      <div
        className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3 px-2`}
      >
        <div
          className={`flex max-w-[75%] flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}
        >
          <ImageMessageCard content={message.content} isOwn={isOwn} />
          <span
            className={`text-xs text-gray-400 ${isOwn ? "pr-1" : "pl-1"}`}
          >
            {formatTime(message.created_at, dateLocale)}
          </span>
        </div>
      </div>
    );
  }

  if (message.message_type === "file") {
    return (
      <div
        className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3 px-2`}
      >
        <div
          className={`flex max-w-[75%] flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}
        >
          <FileMessageCard content={message.content} />
          <span
            className={`text-xs text-gray-400 ${isOwn ? "pr-1" : "pl-1"}`}
          >
            {formatTime(message.created_at, dateLocale)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3 px-2`}
    >
      <div
        className={`flex max-w-[75%] flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}
      >
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isOwn
              ? "rounded-br-md bg-rose-500 text-white"
              : "rounded-bl-md bg-gray-100 text-gray-900"
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <span
          className={`text-xs text-gray-400 ${isOwn ? "pr-1" : "pl-1"}`}
        >
          {formatTime(message.created_at, dateLocale)}
        </span>
      </div>
    </div>
  );
}

export { MessageBubble, type MessageBubbleProps };

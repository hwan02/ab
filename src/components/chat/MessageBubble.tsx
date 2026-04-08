"use client";

import type { Message } from "@/types/database";
import { Card } from "@/components/ui/Card";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ItemRequestCard({ content }: { content: string }) {
  try {
    const data = JSON.parse(content);
    return (
      <Card className="max-w-xs border-amber-200 bg-amber-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg">📦</span>
          <span className="text-sm font-semibold text-amber-800">
            물품 요청
          </span>
        </div>
        <div className="space-y-1 text-sm text-gray-700">
          <p>
            <span className="font-medium">물품:</span> {data.itemName}
          </p>
          <p>
            <span className="font-medium">수량:</span> {data.quantity}
          </p>
          <p>
            <span className="font-medium">긴급도:</span>{" "}
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
              <span className="font-medium">메모:</span> {data.notes}
            </p>
          )}
        </div>
      </Card>
    );
  } catch {
    return <p className="text-sm">{content}</p>;
  }
}

function ReservationRequestCard({ content }: { content: string }) {
  try {
    const data = JSON.parse(content);
    return (
      <Card className="max-w-xs border-blue-200 bg-blue-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg">🍽️</span>
          <span className="text-sm font-semibold text-blue-800">
            예약 요청
          </span>
        </div>
        <div className="space-y-1 text-sm text-gray-700">
          <p>
            <span className="font-medium">레스토랑:</span>{" "}
            {data.restaurantName}
          </p>
          <p>
            <span className="font-medium">날짜:</span> {data.date}
          </p>
          <p>
            <span className="font-medium">시간:</span> {data.time}
          </p>
          <p>
            <span className="font-medium">인원:</span> {data.partySize}명
          </p>
          {data.specialRequests && (
            <p>
              <span className="font-medium">요청사항:</span>{" "}
              {data.specialRequests}
            </p>
          )}
        </div>
      </Card>
    );
  } catch {
    return <p className="text-sm">{content}</p>;
  }
}

function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  if (message.message_type === "item_request") {
    return (
      <div
        className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3 px-2`}
      >
        <div className="flex flex-col gap-1">
          <ItemRequestCard content={message.content} />
          <span
            className={`text-xs text-gray-400 ${isOwn ? "text-right" : "text-left"}`}
          >
            {formatTime(message.created_at)}
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
          <ReservationRequestCard content={message.content} />
          <span
            className={`text-xs text-gray-400 ${isOwn ? "text-right" : "text-left"}`}
          >
            {formatTime(message.created_at)}
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
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
}

export { MessageBubble, type MessageBubbleProps };

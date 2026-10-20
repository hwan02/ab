import { NextRequest, NextResponse } from "next/server";
import { identify } from "@/lib/airbnb/authz";

/**
 * 게스트 활동(채팅, 요청, 숙박 신청)을 Slack 웹훅으로 알린다.
 *
 * 권한: 로그인 세션 또는 Authorization: Bearer $CRON_SECRET 이 있어야 한다.
 *       호출처(채팅방, 물품/예약 요청, 숙박 신청, 숙소 둘러보기)는 모두 로그인한 게스트만 쓰는 화면이다.
 * 입력: 문자열 필드 길이 합계 5,000자까지.
 */

const MAX_TOTAL_CHARS = 5000;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function POST(request: NextRequest) {
  const actor = await identify(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const raw = (body ?? {}) as Record<string, unknown>;
  const senderName = str(raw.senderName);
  const messageType = str(raw.messageType);
  const content = str(raw.content);
  const propertyName = str(raw.propertyName);
  const chatUrl = str(raw.chatUrl);

  const totalChars = senderName.length + messageType.length + content.length + propertyName.length + chatUrl.length;
  if (totalChars > MAX_TOTAL_CHARS) {
    return NextResponse.json({ error: `Too long (max ${MAX_TOTAL_CHARS} chars)` }, { status: 413 });
  }

  const typeLabel: Record<string, string> = {
    text: "💬 메시지",
    item_request: "📦 물품 요청",
    reservation_request: "🍽️ 예약 요청",
    image: "🖼️ 사진",
    file: "📎 파일",
    place_inquiry: "📍 장소 문의",
    guest_request: "🏠 숙박 신청",
  };

  const label = typeLabel[messageType] || "💬 메시지";

  let preview = content;
  if (messageType !== "text" && content) {
    try {
      const parsed = JSON.parse(content);
      if (messageType === "item_request") {
        preview = `${parsed.itemName} x${parsed.quantity}`;
      } else if (messageType === "reservation_request") {
        preview = `${parsed.restaurantName} / ${parsed.date} ${parsed.time} / ${parsed.partySize}명`;
      } else if (messageType === "place_inquiry") {
        preview = `${parsed.placeName} — ${parsed.intent}`;
      } else if (messageType === "guest_request") {
        preview = `${parsed.checkIn} ~ ${parsed.checkOut}`;
      } else if (messageType === "image" || messageType === "file") {
        preview = parsed.fileName || "첨부파일";
      }
    } catch {
      // keep original
    }
  }

  if (preview.length > 100) {
    preview = preview.slice(0, 100) + "…";
  }

  const link = /^https?:\/\//.test(chatUrl) ? `\n<${chatUrl}|채팅 열기>` : "";
  const slackMessage = {
    text: `${label} — *${senderName || "게스트"}*${propertyName ? ` (${propertyName})` : ""}\n>${preview}${link}`,
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackMessage),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Slack request failed" }, { status: 500 });
  }
}

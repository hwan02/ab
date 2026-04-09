import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { senderName, messageType, content, propertyName, chatUrl } = body;

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

  let preview = content || "";
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

  const slackMessage = {
    text: `${label} — *${senderName || "게스트"}*${propertyName ? ` (${propertyName})` : ""}\n>${preview}${chatUrl ? `\n<${chatUrl}|채팅 열기>` : ""}`,
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

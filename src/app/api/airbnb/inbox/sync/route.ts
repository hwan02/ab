/**
 * 에어비앤비 알림 메일 동기화.
 *
 * GET  /api/airbnb/inbox/sync   Vercel Cron 이 호출 (Authorization: Bearer $CRON_SECRET)
 * POST /api/airbnb/inbox/sync   수동 호출. 같은 헤더 필요. body { since?: ISO, limit?: number, dryRun?: boolean }
 *
 * 흐름: 카카오 IMAP → 파싱 → properties 매핑 → airbnb_inbound_mails upsert(중복 무시) → 새 건만 Slack 알림
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchAirbnbMails } from "@/lib/airbnb/mail/imap";
import { parseAirbnbMail, type ParsedAirbnbMail } from "@/lib/airbnb/mail/parse";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDraft, loadPropertyContext, type PropertyContext } from "@/lib/airbnb/draft";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return run({});
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { since?: string; limit?: number; dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // body 없이 호출 가능
  }
  return run({
    since: body.since ? new Date(body.since) : undefined,
    limit: body.limit,
    dryRun: body.dryRun === true,
  });
}

interface RunOptions {
  since?: Date;
  limit?: number;
  dryRun?: boolean;
}

async function run(opts: RunOptions) {
  let mails;
  try {
    mails = await fetchAirbnbMails({ since: opts.since, limit: opts.limit });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "IMAP fetch failed", detail: message }, { status: 502 });
  }

  const parsedRows = mails.map((m) => ({ mail: m, parsed: parseAirbnbMail(m) })).filter((r) => r.parsed.isAirbnb);

  if (opts.dryRun) {
    return NextResponse.json({
      fetched: mails.length,
      airbnb: parsedRows.length,
      items: parsedRows.map(({ mail, parsed }) => ({ messageId: mail.messageId, subject: mail.subject, ...parsed })),
    });
  }

  const supabase = createAdminClient();

  // 숙소 이름 → id 매핑 (이름 포함 매칭)
  const { data: properties } = await supabase.from("properties").select("id, name");
  const propertyList = (properties ?? []) as { id: string; name: string }[];

  let inserted = 0;
  const newItems: { id: string; parsed: ParsedAirbnbMail; propertyId: string | null; propertyName: string | null }[] = [];

  for (const { mail, parsed } of parsedRows) {
    const property = matchProperty(parsed.listingName, propertyList);

    const row = {
      message_id: mail.messageId,
      received_at: mail.date?.toISOString() ?? null,
      subject: mail.subject,
      sender: mail.from,
      kind: parsed.kind,
      guest_name: parsed.guestName,
      listing_name: parsed.listingName,
      thread_url: parsed.threadUrl,
      thread_id: parsed.threadId,
      reservation_code: parsed.reservationCode,
      message_text: parsed.messageText,
      check_in: parsed.checkIn,
      check_out: parsed.checkOut,
      snippet: parsed.snippet,
      property_id: property?.id ?? null,
      raw_text: mail.text ?? null,
    };

    // 이미 있으면 건너뛰기 (message_id unique)
    const { data, error } = await supabase
      .from("airbnb_inbound_mails")
      .upsert(row, { onConflict: "message_id", ignoreDuplicates: true })
      .select("id");

    if (error) {
      console.error("[airbnb sync] insert failed", mail.messageId, error.message);
      continue;
    }
    if (data && data.length > 0) {
      inserted += 1;
      newItems.push({ id: data[0].id as string, parsed, propertyId: property?.id ?? null, propertyName: property?.name ?? null });
    }
  }

  // 새 메시지 메일에 답장 초안을 바로 붙인다. 실패해도(키 없음 등) 수집 자체는 성공으로 둔다.
  let drafted = 0;
  const contextCache = new Map<string, PropertyContext | null>();
  const drafts = new Map<string, string>();
  for (const item of newItems) {
    if (item.parsed.kind !== "message") continue;
    try {
      const key = item.propertyId ?? "__none__";
      if (!contextCache.has(key)) contextCache.set(key, await loadPropertyContext(supabase, item.propertyId));
      const draft = await generateDraft(
        {
          id: item.id,
          guest_name: item.parsed.guestName,
          listing_name: item.parsed.listingName,
          message_text: item.parsed.messageText,
          snippet: item.parsed.snippet,
          check_in: item.parsed.checkIn,
          check_out: item.parsed.checkOut,
          property_id: item.propertyId,
        },
        contextCache.get(key) ?? null
      );
      const { error } = await supabase
        .from("airbnb_inbound_mails")
        .update({ draft_reply: draft, status: "drafted" })
        .eq("id", item.id);
      if (!error) {
        drafts.set(item.id, draft);
        drafted += 1;
      }
    } catch (e) {
      console.error("[airbnb sync] draft failed", item.id, e instanceof Error ? e.message : e);
    }
  }

  await Promise.all(newItems.map((item) => notifySlack(item.parsed, item.propertyName, drafts.get(item.id) ?? null)));

  return NextResponse.json({ fetched: mails.length, airbnb: parsedRows.length, inserted, drafted });
}

function matchProperty(listingName: string | null, properties: { id: string; name: string }[]) {
  if (!listingName) return null;
  const needle = listingName.toLowerCase();
  return (
    properties.find((p) => p.name.toLowerCase() === needle) ??
    properties.find((p) => needle.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(needle)) ??
    null
  );
}

const KIND_LABEL: Record<ParsedAirbnbMail["kind"], string> = {
  message: "💬 에어비앤비 메시지",
  reservation_request: "📅 에어비앤비 예약 요청",
  reservation_confirmed: "✅ 에어비앤비 예약 확정",
  reservation_cancelled: "❌ 에어비앤비 예약 취소",
  review: "⭐ 에어비앤비 후기",
  other: "📨 에어비앤비 알림",
};

async function notifySlack(parsed: ParsedAirbnbMail, propertyName: string | null, draft: string | null) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const where = propertyName ?? parsed.listingName;
  const preview = (parsed.messageText ?? parsed.snippet).replace(/\s+/g, " ").slice(0, 200);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  const text =
    `${KIND_LABEL[parsed.kind]} — *${parsed.guestName ?? "게스트"}*${where ? ` (${where})` : ""}` +
    `\n>${preview}` +
    (draft ? `\n\n✍️ *답장 초안*\n${draft.slice(0, 1500)}` : "") +
    (parsed.threadUrl ? `\n<${parsed.threadUrl}|에어비앤비에서 답장하기>` : "") +
    (appUrl ? ` · <${appUrl}/host/airbnb|수신함>` : "");

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    // best-effort
  }
}

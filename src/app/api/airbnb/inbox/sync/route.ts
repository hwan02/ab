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

  const supabase = createAdminClient();

  // 메일 회신 실패 알림("회신을 전송하지 못했습니다"): 방금 보낸 답장을 되돌리고 Slack 에 알린다.
  const failures = mails.filter((m) => REPLY_FAILED_RE.test(m.subject));
  let replyFailures = 0;
  if (!opts.dryRun) {
    for (const f of failures) {
      if (await handleReplyFailure(supabase, f)) replyFailures += 1;
    }
  }

  // 커뮤니티/마케팅 발신과 분류 불가(계정 활동, 대금 지급 등) 메일은 저장하지 않는다.
  const parsedRows = mails
    .filter((m) => !REPLY_FAILED_RE.test(m.subject))
    .filter((m) => !/hostcommunity|marketing|newsletter/i.test(m.from))
    .map((m) => ({ mail: m, parsed: parseAirbnbMail(m) }))
    .filter((r) => r.parsed.isAirbnb && r.parsed.kind !== "other");

  if (opts.dryRun) {
    return NextResponse.json({
      fetched: mails.length,
      airbnb: parsedRows.length,
      items: parsedRows.map(({ mail, parsed }) => ({ messageId: mail.messageId, subject: mail.subject, ...parsed })),
    });
  }

  // 숙소 이름 → id 매핑 (이름 포함 매칭)
  const { data: properties } = await supabase.from("properties").select("id, name");
  const propertyList = (properties ?? []) as { id: string; name: string }[];

  let inserted = 0;
  let merged = 0;
  const newItems: { id: string; parsed: ParsedAirbnbMail; propertyId: string | null; propertyName: string | null }[] = [];

  // 숙박 문의는 automated@(문의 알림)와 express@(스레드 메시지, Reply-To 있음) 두 통으로 온다.
  // 같은 스레드 + 같은 본문이면 한 건으로 합치고, 회신 주소만 보강한다.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("airbnb_inbound_mails")
    .select("id, thread_id, message_text, reply_to")
    .gte("created_at", since);
  const seen = new Map<string, { id: string; reply_to: string | null }>();
  for (const r of (recent ?? []) as { id: string; thread_id: string | null; message_text: string | null; reply_to: string | null }[]) {
    const key = twinKey(r.thread_id, r.message_text);
    if (key) seen.set(key, { id: r.id, reply_to: r.reply_to });
  }

  // 오래된 것부터 처리해야 "먼저 온 쪽이 남고 나중 쪽이 보강"하는 순서가 된다.
  parsedRows.sort((a, b) => (a.mail.date?.getTime() ?? 0) - (b.mail.date?.getTime() ?? 0));

  for (const { mail, parsed } of parsedRows) {
    const property = matchProperty(parsed.listingName, propertyList);

    const key = twinKey(parsed.threadId, parsed.messageText);
    const twin = key ? seen.get(key) : undefined;
    if (twin) {
      if (!twin.reply_to && mail.replyTo) {
        const { error } = await supabase.from("airbnb_inbound_mails").update({ reply_to: mail.replyTo }).eq("id", twin.id);
        if (!error) {
          twin.reply_to = mail.replyTo;
          merged += 1;
        }
      }
      continue;
    }

    const row = {
      message_id: mail.messageId,
      reply_to: mail.replyTo,
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
      const id = data[0].id as string;
      if (key) seen.set(key, { id, reply_to: mail.replyTo });
      newItems.push({ id, parsed, propertyId: property?.id ?? null, propertyName: property?.name ?? null });
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

  return NextResponse.json({ fetched: mails.length, airbnb: parsedRows.length, inserted, merged, drafted, replyFailures });
}

const REPLY_FAILED_RE = /회신을 전송하지 못했습니다|reply could not be delivered|could not deliver your reply/i;

/**
 * 에어비앤비의 회신 실패 알림을 처리한다. 실패 메일에는 어느 스레드인지 정보가 없으므로,
 * 실패 메일 도착 전 2시간 안에 메일로 보낸 답장 중 가장 최근 것을 되돌린다.
 * 같은 실패 메일을 두 번 처리하지 않도록 message_id 를 airbnb_reply_failures 대신 raw 행으로 기록한다.
 */
async function handleReplyFailure(
  supabase: ReturnType<typeof createAdminClient>,
  mail: { messageId: string; subject: string; text: string | null; date: Date | null; from: string }
): Promise<boolean> {
  // 이미 처리한 실패 메일인지 (message_id unique 로 거른다)
  const { data: marker } = await supabase
    .from("airbnb_inbound_mails")
    .upsert(
      {
        message_id: mail.messageId,
        received_at: mail.date?.toISOString() ?? null,
        subject: mail.subject,
        sender: mail.from,
        kind: "other",
        status: "ignored",
        snippet: (mail.text ?? "").replace(/\s+/g, " ").slice(0, 300),
      },
      { onConflict: "message_id", ignoreDuplicates: true }
    )
    .select("id");
  if (!marker || marker.length === 0) return false; // 이미 처리됨

  const receivedAt = mail.date?.getTime() ?? Date.now();
  const windowStart = new Date(receivedAt - 2 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(receivedAt + 5 * 60 * 1000).toISOString();

  const { data: sent } = await supabase
    .from("airbnb_inbound_mails")
    .select("id, guest_name, sent_reply, sent_at")
    .eq("status", "replied")
    .not("sent_at", "is", null)
    .gte("sent_at", windowStart)
    .lte("sent_at", windowEnd)
    .order("sent_at", { ascending: false })
    .limit(1);

  const reason = /만료/.test(mail.text ?? "") ? "회신 주소가 만료됨" : "에어비앤비가 회신을 거부함";
  const target = sent?.[0] ?? null;

  if (target) {
    await supabase
      .from("airbnb_inbound_mails")
      .update({ status: "drafted", replied_at: null })
      .eq("id", target.id);
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    const text =
      `⚠️ 에어비앤비 메일 회신 실패 — ${reason}` +
      (target
        ? `\n*${target.guest_name ?? "게스트"}* 님에게 보낸 답장이 전달되지 않았습니다. 수신함에서 에어비앤비 링크로 직접 보내 주세요.\n>${(target.sent_reply ?? "").slice(0, 200)}`
        : "\n어느 답장인지 특정하지 못했습니다. 최근 보낸 답장을 에어비앤비에서 확인해 주세요.");
    await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }).catch(
      () => undefined
    );
  }
  return true;
}

/** 같은 스레드의 같은 본문을 한 건으로 묶는 키. 본문이 없으면 묶지 않는다. */
function twinKey(threadId: string | null, messageText: string | null): string | null {
  if (!threadId || !messageText) return null;
  const norm = messageText
    .split(/\n\s*원문에서 자동 번역된 메시지/)[0] // express@ 쪽에만 붙는 번역 블록은 뺀다
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return norm ? `${threadId}|${norm}` : null;
}

/**
 * 메일의 숙소 제목과 properties.name 을 맞춘다.
 * 에어비앤비 제목은 "#홍대입구역 #최대6인 ..." 해시태그 나열이고, 앱의 숙소명은 "[포포스테이 홍대점] #홍대입구역 #인천공항 1시간 ..." 처럼
 * 일부 태그만 겹치므로, 완전 일치 → 포함 → 해시태그 겹침 수 순으로 본다. 숙소가 하나뿐이면 그냥 그 숙소.
 */
export function matchProperty(listingName: string | null, properties: { id: string; name: string }[]) {
  if (properties.length === 1) return properties[0];
  if (!listingName) return null;
  const needle = listingName.toLowerCase();
  const exact =
    properties.find((p) => p.name.toLowerCase() === needle) ??
    properties.find((p) => needle.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(needle));
  if (exact) return exact;

  const tags = (s: string) => new Set((s.toLowerCase().match(/#[^\s#]+/g) ?? []).map((t) => t.replace(/\s+/g, "")));
  const mailTags = tags(needle);
  if (mailTags.size === 0) return null;
  let best: { p: { id: string; name: string }; score: number } | null = null;
  for (const p of properties) {
    const score = [...tags(p.name)].filter((t) => mailTags.has(t)).length;
    if (score >= 2 && (!best || score > best.score)) best = { p, score };
  }
  return best?.p ?? null;
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

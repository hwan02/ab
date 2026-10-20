/**
 * 에어비앤비 알림 메일 동기화 + 키워드 자동응답.
 *
 * GET  /api/airbnb/inbox/sync   Vercel Cron 이 호출 (Authorization: Bearer $CRON_SECRET)
 * POST /api/airbnb/inbox/sync   수동 호출. 같은 헤더 필요. body { since?: ISO, limit?: number, dryRun?: boolean }
 *
 * 흐름: 카카오 IMAP → 파싱 → 숙소 매핑(에어비앤비 리스팅 제목, src/lib/airbnb/sync.ts) → airbnb_inbound_mails upsert(중복 무시)
 *       → 게스트 메시지면 그 숙소의 키워드 규칙과 매칭 → 답변 렌더링
 *       → 숙소의 auto_reply_mode 가 auto 이고 회신 주소가 있으면 카카오 SMTP 로 바로 발송, 아니면 '확인 후 발송' 상태로 둠
 *       → Slack 알림. 숙소를 정하지 못한 메일(제목 불일치·후보 동점)은 '숙소 미확정'으로 알린다.
 *
 * 매 실행 시 최근 7일 안에 숙소가 안 붙은 행(property_id null)을 다시 매핑해 본다.
 * 호스트가 숙소의 리스팅 제목을 나중에 고쳐도 지난 메일이 붙고, 붙으면 규칙도 적용된다.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchAirbnbMails } from "@/lib/airbnb/mail/imap";
import { parseAirbnbMail, type ParsedAirbnbMail } from "@/lib/airbnb/mail/parse";
import { isAirbnbReplyAddress, sendAirbnbReply } from "@/lib/airbnb/mail/smtp";
import { matchRule, pickAnswer, renderAnswer, type ReplyRule } from "@/lib/airbnb/rules";
import { matchProperty, twinKey, type MatchReason } from "@/lib/airbnb/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCT_NAME } from "@/lib/airbnb/brand";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Admin = ReturnType<typeof createAdminClient>;

interface PropertyRow {
  id: string;
  name: string;
  host_id: string;
  airbnb_listing_title: string | null;
  wifi_ssid: string | null;
  wifi_password: string | null;
  checkin_time: string | null;
  checkout_time: string | null;
  address: string | null;
  auto_reply_mode: "off" | "confirm" | "auto";
}

const REACTION_RE = /에 반응\([^)]*\)했습니다\.?$|reacted (?:with )?.{0,4} to /i;

type Outcome =
  | { kind: "auto_sent"; ruleName: string; text: string }
  | { kind: "ready"; ruleName: string; text: string; note?: string }
  | { kind: "needs_reply"; note?: string }
  | { kind: "skipped" };

/** Slack 알림에 필요한 메일 요약. 새로 파싱한 메일과 DB 에서 다시 꺼낸 행을 같은 모양으로 넘긴다. */
interface MailSummary {
  kind: ParsedAirbnbMail["kind"];
  guestName: string | null;
  listingName: string | null;
  messageText: string | null;
  snippet: string | null;
  threadUrl: string | null;
}

interface Notification {
  mail: MailSummary;
  /** 매핑된 숙소. Slack 링크를 그 숙소의 수신함으로 보내는 데 쓴다. */
  propertyId: string | null;
  propertyName: string | null;
  outcome: Outcome;
  /** 숙소 매핑 결과. 매핑됐으면 생략. */
  mapping?: { reason: MatchReason; candidates: string[] };
}

function summarize(parsed: ParsedAirbnbMail): MailSummary {
  return {
    kind: parsed.kind,
    guestName: parsed.guestName,
    listingName: parsed.listingName,
    messageText: parsed.messageText,
    snippet: parsed.snippet,
    threadUrl: parsed.threadUrl,
  };
}

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
      items: parsedRows.map(({ mail, parsed }) => ({ messageId: mail.messageId, subject: mail.subject, replyTo: mail.replyTo, ...parsed })),
    });
  }

  const { data: properties } = await supabase
    .from("properties")
    .select("id, name, host_id, airbnb_listing_title, wifi_ssid, wifi_password, checkin_time, checkout_time, address, auto_reply_mode");
  const propertyList = (properties ?? []) as PropertyRow[];

  let inserted = 0;
  let merged = 0;
  const outcomes: Notification[] = [];

  // 지난 실행에서 숙소를 못 찾은 행을 다시 매핑한다 (리스팅 제목이 그 사이 고쳐졌을 수 있다).
  const remapped = await remapUnmapped(supabase, propertyList, outcomes);

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
    const match = matchProperty(parsed.listingName, propertyList);
    const property = match.property;
    const mapping = property ? undefined : { reason: match.reason, candidates: match.candidates.map((c) => c.name) };

    const key = twinKey(parsed.threadId, parsed.messageText);
    const twin = key ? seen.get(key) : undefined;
    if (twin) {
      if (!twin.reply_to && mail.replyTo) {
        const { error } = await supabase.from("airbnb_inbound_mails").update({ reply_to: mail.replyTo }).eq("id", twin.id);
        if (!error) {
          twin.reply_to = mail.replyTo;
          merged += 1;
          // 회신 주소가 생겼으니 '자동 발송' 모드면 이제 보낼 수 있다
          const outcome = await applyRules(supabase, twin.id, propertyList);
          if (outcome.kind === "auto_sent") {
            outcomes.push({ mail: summarize(parsed), propertyId: property?.id ?? null, propertyName: property?.name ?? null, outcome });
          }
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
      const outcome = await applyRules(supabase, id, propertyList);
      outcomes.push({ mail: summarize(parsed), propertyId: property?.id ?? null, propertyName: property?.name ?? null, outcome, mapping });
    }
  }

  await Promise.all(outcomes.map((o) => notifySlack(o)));

  const autoSent = outcomes.filter((o) => o.outcome.kind === "auto_sent").length;
  const ready = outcomes.filter((o) => o.outcome.kind === "ready").length;
  const needsReply = outcomes.filter((o) => o.outcome.kind === "needs_reply").length;
  const unmapped = outcomes.filter((o) => o.mapping).length;

  return NextResponse.json({
    fetched: mails.length,
    airbnb: parsedRows.length,
    inserted,
    merged,
    remapped,
    unmapped,
    autoSent,
    ready,
    needsReply,
    replyFailures,
  });
}

// ---------------------------------------------------------------------------
// 미매핑 행 재매핑
// ---------------------------------------------------------------------------

interface UnmappedRow {
  id: string;
  kind: ParsedAirbnbMail["kind"];
  guest_name: string | null;
  listing_name: string | null;
  message_text: string | null;
  snippet: string | null;
  thread_url: string | null;
}

/**
 * 최근 7일 안에 들어왔지만 숙소가 안 붙은 행을 listing_name 으로 다시 매핑한다.
 * 붙으면 규칙을 적용하고, 결과가 있으면(발송·답변 준비·답변 필요) Slack 알림 목록에 넣는다.
 * 여전히 애매하거나 안 맞는 행은 조용히 둔다 — 매 실행마다 같은 알림을 반복하지 않는다.
 * 돌아오는 값은 새로 붙은 행 수.
 */
async function remapUnmapped(supabase: Admin, properties: PropertyRow[], outcomes: Notification[]): Promise<number> {
  if (properties.length === 0) return 0;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("airbnb_inbound_mails")
    .select("id, kind, guest_name, listing_name, message_text, snippet, thread_url")
    .is("property_id", null)
    .not("listing_name", "is", null)
    .gte("created_at", since)
    .limit(200);
  if (error) {
    console.error("[airbnb sync] remap query failed", error.message);
    return 0;
  }

  let count = 0;
  for (const row of (data ?? []) as UnmappedRow[]) {
    const match = matchProperty(row.listing_name, properties);
    if (!match.property) continue;
    const { error: updateError } = await supabase
      .from("airbnb_inbound_mails")
      .update({ property_id: match.property.id })
      .eq("id", row.id)
      .is("property_id", null);
    if (updateError) {
      console.error("[airbnb sync] remap update failed", row.id, updateError.message);
      continue;
    }
    count += 1;
    const outcome = await applyRules(supabase, row.id, properties);
    if (outcome.kind === "skipped") continue;
    outcomes.push({
      mail: {
        kind: row.kind,
        guestName: row.guest_name,
        listingName: row.listing_name,
        messageText: row.message_text,
        snippet: row.snippet,
        threadUrl: row.thread_url,
      },
      propertyId: match.property.id,
      propertyName: match.property.name,
      outcome,
    });
  }
  return count;
}

// ---------------------------------------------------------------------------
// 규칙 매칭 + 발송
// ---------------------------------------------------------------------------

interface MailRow {
  id: string;
  kind: string;
  status: string;
  message_text: string | null;
  guest_name: string | null;
  thread_id: string | null;
  reply_to: string | null;
  subject: string;
  message_id: string;
  property_id: string | null;
  check_in: string | null;
  check_out: string | null;
  matched_rule_id: string | null;
  auto_sent: boolean;
  draft_reply: string | null;
}

/**
 * 메일 한 건에 규칙을 적용한다. 매칭되면 답변을 채우고(status=drafted),
 * 숙소가 자동 발송 모드이고 회신 주소가 있으면 바로 보낸다(status=replied, auto_sent=true).
 * 이미 매칭된 행(회신 주소가 나중에 보강된 경우)은 발송 단계만 다시 본다.
 */
async function applyRules(supabase: Admin, mailId: string, properties: PropertyRow[]): Promise<Outcome> {
  const { data } = await supabase
    .from("airbnb_inbound_mails")
    .select("id, kind, status, message_text, guest_name, thread_id, reply_to, subject, message_id, property_id, check_in, check_out, matched_rule_id, auto_sent, draft_reply")
    .eq("id", mailId)
    .maybeSingle();
  const mail = data as MailRow | null;
  if (!mail || mail.kind !== "message") return { kind: "skipped" };
  if (mail.status === "replied" || mail.status === "ignored" || mail.auto_sent) return { kind: "skipped" };

  const property = properties.find((p) => p.id === mail.property_id);
  if (!property) return { kind: "needs_reply", note: "숙소를 찾지 못함 (에어비앤비 리스팅 제목 확인)" };
  if (property.auto_reply_mode === "off") return { kind: "skipped" };
  if (!mail.message_text) return { kind: "needs_reply", note: "메시지 본문 없음" };

  // 게스트가 이모지 반응만 한 경우("'…'에 반응(❤️)했습니다"): 답장할 내용이 없으니 무시 처리
  if (REACTION_RE.test(mail.message_text.trim())) {
    await supabase.from("airbnb_inbound_mails").update({ status: "ignored" }).eq("id", mail.id);
    return { kind: "skipped" };
  }

  let rule: ReplyRule | null = null;
  let text = mail.draft_reply ?? "";

  if (mail.matched_rule_id && text) {
    const { data: r } = await supabase.from("airbnb_reply_rules").select("*").eq("id", mail.matched_rule_id).maybeSingle();
    rule = (r as ReplyRule | null) ?? null;
  }

  if (!rule) {
    const { data: rules } = await supabase.from("airbnb_reply_rules").select("*").eq("property_id", property.id).eq("enabled", true);
    const m = matchRule(mail.message_text, (rules ?? []) as ReplyRule[]);
    if (!m) return { kind: "needs_reply" };
    rule = m.rule;
    text = renderAnswer(pickAnswer(rule, mail.message_text), {
      guestName: mail.guest_name,
      propertyName: property.name,
      checkIn: mail.check_in,
      checkOut: mail.check_out,
      checkinTime: property.checkin_time,
      checkoutTime: property.checkout_time,
      wifiSsid: property.wifi_ssid,
      wifiPassword: property.wifi_password,
      address: property.address,
    });
    await supabase.from("airbnb_inbound_mails").update({ matched_rule_id: rule.id, draft_reply: text, status: "drafted" }).eq("id", mail.id);
  }

  if (property.auto_reply_mode !== "auto") return { kind: "ready", ruleName: rule.name, text };
  if (!isAirbnbReplyAddress(mail.reply_to)) {
    return { kind: "ready", ruleName: rule.name, text, note: "회신 주소가 아직 없음 (스레드 메일 대기)" };
  }

  // 같은 스레드에 같은 규칙으로 1시간 내 두 번 보내지 않는다
  if (mail.thread_id) {
    const { data: dup } = await supabase
      .from("airbnb_inbound_mails")
      .select("id")
      .eq("thread_id", mail.thread_id)
      .eq("matched_rule_id", rule.id)
      .eq("auto_sent", true)
      .gte("sent_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(1);
    if (dup && dup.length > 0) return { kind: "ready", ruleName: rule.name, text, note: "같은 답변을 1시간 내 이미 보냄" };
  }

  // 발송 경쟁 방어: 겹친 크론 실행이나 호스트의 수동 발송과 같은 행을 두 번 보내지 않도록
  // status 를 먼저 조건부로 'replied' 로 바꿔 선점한다. 선점에 실패하면(이미 replied) 보내지 않는다.
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("airbnb_inbound_mails")
    .update({ status: "replied", replied_at: now, auto_sent: true })
    .eq("id", mail.id)
    .neq("status", "replied")
    .select("id");
  if (claimError || !claimed || claimed.length === 0) return { kind: "skipped" };

  try {
    await sendAirbnbReply({ to: mail.reply_to, subject: mail.subject, text, inReplyTo: mail.message_id });
  } catch (e) {
    console.error("[airbnb sync] auto send failed", mail.id, e instanceof Error ? e.message : e);
    // 선점을 되돌려 호스트가 수신함에서 다시 보낼 수 있게 한다
    await supabase.from("airbnb_inbound_mails").update({ status: "drafted", replied_at: null, auto_sent: false }).eq("id", mail.id);
    return { kind: "ready", ruleName: rule.name, text, note: "발송 실패: " + (e instanceof Error ? e.message : String(e)) };
  }

  await supabase.from("airbnb_inbound_mails").update({ sent_reply: text, sent_at: now }).eq("id", mail.id);
  const { data: cur } = await supabase.from("airbnb_reply_rules").select("hit_count").eq("id", rule.id).maybeSingle();
  await supabase
    .from("airbnb_reply_rules")
    .update({ hit_count: ((cur?.hit_count as number | undefined) ?? 0) + 1, last_hit_at: now })
    .eq("id", rule.id);

  return { kind: "auto_sent", ruleName: rule.name, text };
}

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------

const KIND_LABEL: Record<ParsedAirbnbMail["kind"], string> = {
  message: "💬 에어비앤비 메시지",
  reservation_request: "📅 에어비앤비 예약 요청",
  reservation_confirmed: "✅ 에어비앤비 예약 확정",
  reservation_cancelled: "❌ 에어비앤비 예약 취소",
  review: "⭐ 에어비앤비 후기",
  other: "📨 에어비앤비 알림",
};

async function notifySlack({ mail, propertyId, propertyName, outcome, mapping }: Notification) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const where = propertyName ?? mail.listingName;
  const preview = (mail.messageText ?? mail.snippet ?? "").replace(/\s+/g, " ").slice(0, 200);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);

  let tail = "";
  if (mapping) {
    if (mapping.reason === "ambiguous") {
      tail += `\n\n🏠 *숙소 미확정* — 리스팅 제목이 여러 숙소와 같은 점수로 겹칩니다: ${mapping.candidates.join(", ")}. 각 숙소의 에어비앤비 리스팅 제목을 서로 다르게 맞춰 주세요.`;
    } else if (mapping.reason === "no_listing") {
      tail += "\n\n🏠 *숙소 미확정* — 메일에서 숙소 제목을 찾지 못했습니다.";
    } else {
      tail += "\n\n🏠 *숙소 미확정* — 맞는 숙소가 없습니다. 숙소 설정의 에어비앤비 리스팅 제목을 메일의 제목과 같게 맞춰 주세요.";
    }
  }
  if (outcome.kind === "auto_sent") {
    tail += `\n\n🤖 *${PRODUCT_NAME} 자동 발송됨* (규칙: ${outcome.ruleName})\n${outcome.text.slice(0, 600)}`;
  } else if (outcome.kind === "ready") {
    tail += `\n\n✍️ *답변 준비됨* (규칙: ${outcome.ruleName})${outcome.note ? ` · ${outcome.note}` : ""} — 수신함에서 확인 후 보내세요\n${outcome.text.slice(0, 600)}`;
  } else if (outcome.kind === "needs_reply") {
    tail += `\n\n🙋 *답변 필요* — 매칭되는 규칙이 없습니다${outcome.note ? ` (${outcome.note})` : ""}`;
  }

  // 숙소가 매핑된 메일은 그 숙소의 수신함으로, 미확정 메일은 관리자 전역 수신함으로.
  const inboxPath = propertyId ? `/host/property/${propertyId}/inbox` : `/host/airbnb${mapping ? "?property=unmapped" : ""}`;
  const inboxUrl = appUrl ? `${appUrl}${inboxPath}` : null;
  const text =
    `${KIND_LABEL[mail.kind]} — *${mail.guestName ?? "게스트"}*${where ? ` (${where})` : ""}` +
    `\n>${preview}` +
    tail +
    (mail.threadUrl ? `\n<${mail.threadUrl}|에어비앤비에서 보기>` : "") +
    (inboxUrl ? ` · <${inboxUrl}|${PRODUCT_NAME} 수신함>` : "");

  try {
    await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// 회신 실패 처리
// ---------------------------------------------------------------------------

const REPLY_FAILED_RE = /회신을 전송하지 못했습니다|reply could not be delivered|could not deliver your reply/i;

/**
 * 에어비앤비의 회신 실패 알림을 처리한다. 실패 메일에는 어느 스레드인지 정보가 없으므로,
 * 실패 메일 도착 전 2시간 안에 메일로 보낸 답장 중 가장 최근 것을 되돌린다.
 * 같은 실패 메일을 두 번 처리하지 않도록 message_id unique 로 거른다.
 */
async function handleReplyFailure(
  supabase: Admin,
  mail: { messageId: string; subject: string; text: string | null; date: Date | null; from: string }
): Promise<boolean> {
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
    await supabase.from("airbnb_inbound_mails").update({ status: "drafted", replied_at: null, auto_sent: false }).eq("id", target.id);
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    const text =
      `⚠️ ${PRODUCT_NAME} 메일 회신 실패 — ${reason}` +
      (target
        ? `\n*${target.guest_name ?? "게스트"}* 님에게 보낸 답장이 전달되지 않았습니다. 수신함에서 에어비앤비 링크로 직접 보내 주세요.\n>${(target.sent_reply ?? "").slice(0, 200)}`
        : "\n어느 답장인지 특정하지 못했습니다. 최근 보낸 답장을 에어비앤비에서 확인해 주세요.");
    await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }).catch(
      () => undefined
    );
  }
  return true;
}

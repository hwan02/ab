/**
 * 에어비앤비 게스트 메시지 답장 초안 생성.
 *
 * 수집된 airbnb_inbound_mails 행(kind='message') 하나에 대해, 매핑된 숙소의 안내문과 가이드, FAQ 를
 * 컨텍스트로 넣고 LLM 에게 게스트 언어로 답장 초안을 쓰게 한다. 발송은 하지 않는다.
 * 호스트가 /host/airbnb 에서 초안을 보고 에어비앤비에 직접 붙여넣는다.
 *
 * 모델: Vercel AI Gateway 를 통해 "provider/model" 문자열로 호출한다.
 *   - 로컬: AI_GATEWAY_API_KEY 환경변수 (vercel.com → AI → API Keys)
 *   - Vercel 배포: OIDC 로 자동 인증, 키 불필요
 *   - AIRBNB_DRAFT_MODEL 로 모델을 바꿀 수 있다. 기본 anthropic/claude-opus-5.5
 */

import { generateText } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_DRAFT_MODEL = "anthropic/claude-opus-5.5";

export interface DraftSourceMail {
  id: string;
  guest_name: string | null;
  listing_name: string | null;
  message_text: string | null;
  snippet: string | null;
  check_in: string | null;
  check_out: string | null;
  property_id: string | null;
}

export interface PropertyContext {
  name: string;
  description: string | null;
  address: string | null;
  wifi_ssid: string | null;
  wifi_password: string | null;
  checkin_guide: string | null;
  checkout_guide: string | null;
  house_rules: string | null;
  guides: { title: string; category: string; content: string | null }[];
  faqs: { question: string; answer: string }[];
}

export function draftModelId(): string {
  return process.env.AIRBNB_DRAFT_MODEL?.trim() || DEFAULT_DRAFT_MODEL;
}

// ---------------------------------------------------------------------------
// 컨텍스트 로드
// ---------------------------------------------------------------------------

export async function loadPropertyContext(
  supabase: SupabaseClient,
  propertyId: string | null
): Promise<PropertyContext | null> {
  const [{ data: property }, { data: faqs }] = await Promise.all([
    propertyId
      ? supabase
          .from("properties")
          .select("name, description, address, wifi_ssid, wifi_password, checkin_guide, checkout_guide, house_rules")
          .eq("id", propertyId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("faqs").select("question, answer").order("sort_order", { ascending: true }),
  ]);

  const { data: guides } = propertyId
    ? await supabase
        .from("property_guides")
        .select("title, category, content")
        .eq("property_id", propertyId)
        .order("display_order", { ascending: true })
    : { data: [] };

  if (!property && (!faqs || faqs.length === 0)) return null;

  return {
    name: property?.name ?? "",
    description: property?.description ?? null,
    address: property?.address ?? null,
    wifi_ssid: property?.wifi_ssid ?? null,
    wifi_password: property?.wifi_password ?? null,
    checkin_guide: property?.checkin_guide ?? null,
    checkout_guide: property?.checkout_guide ?? null,
    house_rules: property?.house_rules ?? null,
    guides: (guides ?? []) as PropertyContext["guides"],
    faqs: (faqs ?? []) as PropertyContext["faqs"],
  };
}

// ---------------------------------------------------------------------------
// 프롬프트
// ---------------------------------------------------------------------------

export function buildInstructions(): string {
  return [
    "당신은 한국의 소규모 숙소 호스트를 돕는 어시스턴트입니다. 호스트가 에어비앤비 게스트에게 보낼 답장 초안을 씁니다.",
    "",
    "규칙:",
    "- 게스트가 쓴 언어와 같은 언어로 답합니다. 게스트가 영어로 쓰면 영어, 일본어면 일본어, 한국어면 한국어.",
    "- 아래 제공된 숙소 정보, 가이드, FAQ 안에 있는 사실만 사용합니다. 정보에 없는 내용은 지어내지 말고, 호스트가 확인한 뒤 답하겠다고 정중히 말합니다.",
    "- 짧고 친절하게. 인사 한 줄, 핵심 답변, 필요하면 다음 행동 한 줄. 대개 3~6문장.",
    "- 호스트 이름이나 서명은 넣지 않습니다. 호스트가 붙여넣기 전에 다듬을 수 있도록 본문만 씁니다.",
    "- 가격 할인, 환불, 예약 변경처럼 호스트의 결정이 필요한 요청은 확답하지 말고 '확인 후 안내드리겠다'는 톤으로 씁니다.",
    "- 마크다운, 제목, 목록 기호를 쓰지 않습니다. 메신저에 붙여넣을 평문만 출력합니다.",
    "- 답장 본문만 출력합니다. 설명이나 따옴표를 붙이지 않습니다.",
  ].join("\n");
}

export function formatContext(ctx: PropertyContext | null): string {
  if (!ctx) return "(숙소 정보 없음. 일반적인 안내만 하고, 구체적인 사항은 확인 후 답하겠다고 쓰세요.)";

  const lines: string[] = [];
  if (ctx.name) lines.push(`숙소 이름: ${ctx.name}`);
  if (ctx.address) lines.push(`주소: ${ctx.address}`);
  if (ctx.description) lines.push(`소개: ${ctx.description}`);
  if (ctx.wifi_ssid) lines.push(`와이파이: ${ctx.wifi_ssid}${ctx.wifi_password ? ` / 비밀번호 ${ctx.wifi_password}` : ""}`);
  if (ctx.checkin_guide) lines.push(`체크인 안내:\n${ctx.checkin_guide}`);
  if (ctx.checkout_guide) lines.push(`체크아웃 안내:\n${ctx.checkout_guide}`);
  if (ctx.house_rules) lines.push(`숙소 이용 규칙:\n${ctx.house_rules}`);

  if (ctx.guides.length > 0) {
    lines.push("가이드:");
    for (const g of ctx.guides) {
      lines.push(`- [${g.category}] ${g.title}${g.content ? `: ${g.content}` : ""}`);
    }
  }
  if (ctx.faqs.length > 0) {
    lines.push("자주 묻는 질문:");
    for (const f of ctx.faqs) {
      lines.push(`- Q: ${f.question}\n  A: ${f.answer}`);
    }
  }
  return lines.join("\n");
}

export function buildPrompt(mail: DraftSourceMail, ctx: PropertyContext | null): string {
  const guestMessage = mail.message_text?.trim() || mail.snippet?.trim() || "(메시지 본문이 메일에 포함되지 않음)";
  const stay =
    mail.check_in || mail.check_out
      ? `예약 기간: ${mail.check_in ?? "?"} ~ ${mail.check_out ?? "?"}`
      : "예약 기간: 알 수 없음";

  return [
    "## 숙소 정보",
    formatContext(ctx),
    "",
    "## 게스트",
    `이름: ${mail.guest_name ?? "게스트"}`,
    stay,
    "",
    "## 게스트 메시지",
    guestMessage,
    "",
    "위 게스트 메시지에 대한 답장 초안을 써 주세요.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// 생성
// ---------------------------------------------------------------------------

export async function generateDraft(mail: DraftSourceMail, ctx: PropertyContext | null): Promise<string> {
  const { text } = await generateText({
    model: draftModelId(),
    instructions: buildInstructions(),
    prompt: buildPrompt(mail, ctx),
    maxOutputTokens: 1024,
  });
  return text.trim();
}

/**
 * status='new' 인 메시지 메일에 초안을 채운다. 반환값은 처리 결과 요약.
 * 한 건이 실패해도 나머지는 계속 진행한다.
 */
export async function draftPendingMails(
  supabase: SupabaseClient,
  opts: { limit?: number; ids?: string[] } = {}
): Promise<{ drafted: string[]; failed: { id: string; error: string }[] }> {
  let query = supabase
    .from("airbnb_inbound_mails")
    .select("id, guest_name, listing_name, message_text, snippet, check_in, check_out, property_id")
    .eq("kind", "message")
    .order("received_at", { ascending: false })
    .limit(opts.limit ?? 20);

  query = opts.ids && opts.ids.length > 0 ? query.in("id", opts.ids) : query.eq("status", "new");

  const { data: rows, error } = await query;
  if (error) throw new Error(`inbound mails query failed: ${error.message}`);

  const drafted: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const contextCache = new Map<string, PropertyContext | null>();

  for (const row of (rows ?? []) as DraftSourceMail[]) {
    try {
      const key = row.property_id ?? "__none__";
      if (!contextCache.has(key)) {
        contextCache.set(key, await loadPropertyContext(supabase, row.property_id));
      }
      const draft = await generateDraft(row, contextCache.get(key) ?? null);
      const { error: updateError } = await supabase
        .from("airbnb_inbound_mails")
        .update({ draft_reply: draft, status: "drafted" })
        .eq("id", row.id);
      if (updateError) throw new Error(updateError.message);
      drafted.push(row.id);
    } catch (e) {
      failed.push({ id: row.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { drafted, failed };
}

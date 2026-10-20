/**
 * 게스트 메시지에 메일 회신으로 답장을 보낸다.
 *
 * POST /api/airbnb/inbox/send
 *   인증: 로그인한 호스트(관리자 이메일) 세션 또는 Authorization: Bearer $CRON_SECRET
 *   body: { id: string, text?: string }
 *     text 가 없으면 저장된 draft_reply 를 보낸다.
 *
 * 보내기 전에 status 를 조건부로 'replied' 로 바꿔 선점한다(이미 replied 면 409).
 * 자동 발송 크론과 호스트의 수동 발송이 같은 메일을 두 번 보내지 않게 하기 위해서다.
 * 보낸 뒤 sent_reply / sent_at 을 기록한다. 발송에 실패하면 선점을 되돌린다.
 * 실제로 에어비앤비 스레드에 올라갔는지는 에어비앤비 쪽에서 확인해야 한다(메일 회신은 비동기).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAirbnbReplyAddress, sendAirbnbReply } from "@/lib/airbnb/mail/smtp";
import { canAccessMails, identify } from "@/lib/airbnb/authz";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const actor = await identify(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; text?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!(await canAccessMails(actor, [body.id]))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("airbnb_inbound_mails")
    .select("id, message_id, subject, reply_to, draft_reply, status, guest_name")
    .eq("id", body.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (!isAirbnbReplyAddress(row.reply_to)) {
    return NextResponse.json(
      { error: "이 메일에는 회신 주소가 없습니다. 에어비앤비에서 직접 답장해 주세요." },
      { status: 422 }
    );
  }

  const text = (body.text ?? row.draft_reply ?? "").trim();
  if (!text) return NextResponse.json({ error: "보낼 답장 본문이 없습니다." }, { status: 422 });

  // 선점: 이미 replied 면(자동 발송이 먼저 보냈거나 다른 탭에서 보냈거나) 보내지 않는다.
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("airbnb_inbound_mails")
    .update({ status: "replied", replied_at: now, draft_reply: text })
    .eq("id", row.id)
    .neq("status", "replied")
    .select("id");
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: "이미 답장이 발송된 메일입니다. 수신함을 새로고침해 주세요." }, { status: 409 });
  }

  try {
    const { messageId } = await sendAirbnbReply({
      to: row.reply_to,
      subject: row.subject,
      text,
      inReplyTo: row.message_id,
    });

    await supabase.from("airbnb_inbound_mails").update({ sent_reply: text, sent_at: now }).eq("id", row.id);

    return NextResponse.json({ ok: true, messageId, sentAt: now });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // 선점을 되돌린다. 원래 상태가 new 였어도 본문이 있으니 drafted 로 둔다.
    await supabase
      .from("airbnb_inbound_mails")
      .update({ status: row.status === "ignored" ? "ignored" : "drafted", replied_at: null })
      .eq("id", row.id);
    return NextResponse.json({ error: "send failed", detail: message }, { status: 502 });
  }
}

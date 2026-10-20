/**
 * 게스트 메시지에 메일 회신으로 답장을 보낸다.
 *
 * POST /api/airbnb/inbox/send
 *   인증: 로그인한 호스트(관리자 이메일) 세션 또는 Authorization: Bearer $CRON_SECRET
 *   body: { id: string, text?: string }
 *     text 가 없으면 저장된 draft_reply 를 보낸다.
 *
 * 보낸 뒤 sent_reply / sent_at 을 기록하고 status 를 'replied' 로 바꾼다.
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

  try {
    const { messageId } = await sendAirbnbReply({
      to: row.reply_to,
      subject: row.subject,
      text,
      inReplyTo: row.message_id,
    });

    const now = new Date().toISOString();
    await supabase
      .from("airbnb_inbound_mails")
      .update({ sent_reply: text, sent_at: now, status: "replied", replied_at: now, draft_reply: text })
      .eq("id", row.id);

    return NextResponse.json({ ok: true, messageId, sentAt: now });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "send failed", detail: message }, { status: 502 });
  }
}

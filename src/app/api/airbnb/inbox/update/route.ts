/**
 * 수신함 메일의 초안·상태 갱신.
 *
 * POST /api/airbnb/inbox/update
 *   인증: 로그인한 호스트(자기 숙소 메일만) 또는 관리자 이메일 세션, 또는 Authorization: Bearer $CRON_SECRET
 *   body: { id: string, draft_reply?: string | null, status?: "new" | "drafted" | "ignored" }
 *
 * 브라우저 supabase 클라이언트(RLS)로 직접 update 하면 관리자가 남의 숙소 메일이나 숙소 미확정 메일을
 * 고칠 때 0행 갱신이 조용히 일어나므로, 권한 검사 뒤 admin 클라이언트로 쓴다.
 * 'replied' 로의 전이는 /send 가 맡는다(선점 로직).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessMails, identify } from "@/lib/airbnb/authz";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "drafted", "ignored"] as const;
type Status = (typeof STATUSES)[number];

export async function POST(req: NextRequest) {
  const actor = await identify(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: unknown; draft_reply?: unknown; status?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }
  if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const changes: { draft_reply?: string | null; status?: Status } = {};
  if (body.draft_reply !== undefined) {
    if (body.draft_reply !== null && typeof body.draft_reply !== "string") {
      return NextResponse.json({ error: "draft_reply must be string or null" }, { status: 400 });
    }
    changes.draft_reply = body.draft_reply === "" ? null : body.draft_reply;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as Status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });
    changes.status = body.status as Status;
  }
  if (Object.keys(changes).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  if (!(await canAccessMails(actor, [body.id]))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createAdminClient();
  // 발송된 메일은 건드리지 않는다.
  const { data, error } = await supabase
    .from("airbnb_inbound_mails")
    .update(changes)
    .eq("id", body.id)
    .neq("status", "replied")
    .select("id, status, draft_reply")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "이미 답장이 발송된 메일입니다." }, { status: 409 });

  return NextResponse.json({ ok: true, status: data.status, draft_reply: data.draft_reply });
}

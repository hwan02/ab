/**
 * 답장 초안 생성.
 *
 * POST /api/airbnb/inbox/draft
 *   인증: Authorization: Bearer $CRON_SECRET  또는  로그인한 호스트(관리자 이메일) 세션
 *   body: { ids?: string[], limit?: number }
 *     ids 가 있으면 그 행들만(상태 무관, 재생성), 없으면 status='new' 인 메시지 메일 전부.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { draftPendingMails } from "@/lib/airbnb/draft";
import { canAccessMails, identify } from "@/lib/airbnb/authz";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const actor = await identify(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { ids?: string[]; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // body 없이 호출 가능
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === "string") : undefined;
  // 호스트는 자기 숙소 메일만, 그리고 id 를 지정한 경우만 (전체 생성은 cron/admin)
  if (actor.kind === "host" && (!ids || !(await canAccessMails(actor, ids)))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await draftPendingMails(createAdminClient(), {
      ids,
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "draft failed", detail: message }, { status: 500 });
  }
}

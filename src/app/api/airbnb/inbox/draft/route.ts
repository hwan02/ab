/**
 * 답장 초안 생성.
 *
 * POST /api/airbnb/inbox/draft
 *   인증: Authorization: Bearer $CRON_SECRET  또는  로그인한 호스트(관리자 이메일) 세션
 *   body: { ids?: string[], limit?: number }
 *     ids 가 있으면 그 행들만(상태 무관, 재생성), 없으면 status='new' 인 메시지 메일 전부.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { draftPendingMails } from "@/lib/airbnb/draft";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function authorize(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (secret && header === `Bearer ${secret}`) return true;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user && !!process.env.NEXT_PUBLIC_ADMIN_EMAIL && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { ids?: string[]; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // body 없이 호출 가능
  }

  try {
    const result = await draftPendingMails(createAdminClient(), {
      ids: Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === "string") : undefined,
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "draft failed", detail: message }, { status: 500 });
  }
}

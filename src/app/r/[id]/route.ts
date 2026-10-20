import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** 자동응답 답장에 붙는 짧은 사진 링크. 규칙 id 로 사진을 찾아 리디렉트한다. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const { data } = await createAdminClient().from("airbnb_reply_rules").select("photo_url").eq("id", id).maybeSingle();
  const url = data?.photo_url as string | undefined;
  if (!url || !/^https:\/\//.test(url)) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(url, 302);
}

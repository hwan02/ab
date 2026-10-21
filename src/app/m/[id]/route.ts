import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** 장소 목록 답장에 붙는 짧은 지도 링크. 장소 id 로 구글 지도 주소를 찾아 리디렉트한다. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const { data } = await createAdminClient().from("food_places").select("maps_url, name").eq("id", id).maybeSingle();
  const url = (data?.maps_url as string | undefined) ?? (data?.name ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.name as string)}` : undefined);
  if (!url || !/^https:\/\//.test(url)) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(url, 302);
}

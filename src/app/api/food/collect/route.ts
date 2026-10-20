/**
 * 숙소 주변 맛집 자동 수집.  POST /api/food/collect { propertyId }  (숙소 소유 호스트 세션)
 *
 * 비용(2026-10 기준, Google 무료 한도는 월별·SKU별):
 *   Nearby Search Enterprise(영업시간·평점 필드) 월 1,000건 무료 → 수집 1회 8건 → 월 약 125회 무료.
 *   Text Search Pro(좌표) 월 5,000건 무료, 숙소당 최초 1회.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectFood } from "@/lib/food/collect";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) return NextResponse.json({ error: "GOOGLE_MAPS_SERVER_KEY 가 설정되지 않았습니다." }, { status: 503 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { propertyId } = (await req.json().catch(() => ({}))) as { propertyId?: string };
  if (!propertyId) return NextResponse.json({ error: "propertyId required" }, { status: 400 });

  const { data: property } = await supabase.from("properties").select("host_id").eq("id", propertyId).maybeSingle();
  if (!property || property.host_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    return NextResponse.json(await collectFood(createAdminClient(), propertyId, key));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const disabled = /has not been used|is disabled|referer|PERMISSION_DENIED/i.test(message);
    return NextResponse.json(
      { error: disabled ? "Google 서버 키 설정을 확인해 주세요 (Places API (New) 사용, 애플리케이션 제한 없음)." : `수집 실패: ${message}` },
      { status: disabled ? 503 : 502 }
    );
  }
}

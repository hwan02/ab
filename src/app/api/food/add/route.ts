/** 구글 지도 링크로 장소 추가.  POST /api/food/add { propertyId, url, groupId? }  (숙소 소유 호스트 세션) */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addPlaceFromUrl } from "@/lib/food/addFromUrl";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) return NextResponse.json({ error: "GOOGLE_MAPS_SERVER_KEY 가 설정되지 않았습니다." }, { status: 503 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { propertyId, url, groupId } = (await req.json().catch(() => ({}))) as { propertyId?: string; url?: string; groupId?: string };
  if (!propertyId || !url) return NextResponse.json({ error: "propertyId, url 이 필요합니다." }, { status: 400 });

  const { data: property } = await supabase.from("properties").select("host_id").eq("id", propertyId).maybeSingle();
  if (!property || property.host_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  try {
    const added = await addPlaceFromUrl(admin, propertyId, url, key);
    if (groupId) {
      const { data: g } = await admin.from("food_groups").select("id").eq("id", groupId).eq("property_id", propertyId).maybeSingle();
      if (g) {
        const { count } = await admin.from("food_group_items").select("id", { count: "exact", head: true }).eq("group_id", groupId);
        await admin
          .from("food_group_items")
          .upsert({ group_id: groupId, food_place_id: added.id, sort_order: count ?? 0 }, { onConflict: "group_id,food_place_id", ignoreDuplicates: true });
      }
    }
    return NextResponse.json(added);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 422 });
  }
}

/**
 * 숙소 맛집 수집을 서버 밖에서 돌린다(운영자용).
 *   node --env-file=.env.local scripts/food-collect.ts [property_id]
 */
import { createClient } from "@supabase/supabase-js";
import { collectFood } from "../src/lib/food/collect.ts";
import { SITUATIONS, renderFoodList, type FoodPlace } from "../src/lib/food/places.ts";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let propertyId = process.argv[2];
if (!propertyId) {
  const { data } = await admin.from("properties").select("id, name").order("created_at").limit(1).single();
  propertyId = data!.id as string;
  console.log(`숙소: ${data!.name}`);
}
const r = await collectFood(admin, propertyId, process.env.GOOGLE_MAPS_SERVER_KEY!);
console.log(`새로 ${r.added}곳, 갱신 ${r.updated}곳, 사진 ${r.photos}장\n`);
const { data } = await admin.from("food_places").select("*").eq("property_id", propertyId);
for (const s of SITUATIONS) {
  const list = ((data ?? []) as FoodPlace[]).filter((p) => p.situation === s.key);
  console.log(`[${s.label}] ${list.length}곳 중 상위 5`);
  console.log(renderFoodList(list, "ko") || "(없음)");
  console.log();
}

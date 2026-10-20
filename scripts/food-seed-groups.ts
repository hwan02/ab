/**
 * 자동 분류대로 기본 장소 그룹을 만든다(이미 같은 이름 그룹이 있으면 건너뜀).
 *   node --env-file=.env.local scripts/food-seed-groups.ts [property_id]
 */
import { createClient } from "@supabase/supabase-js";
import { SITUATIONS, type FoodPlace } from "../src/lib/food/places.ts";
import { groupRule, renderGroup, type FoodGroup, type FoodGroupItem } from "../src/lib/food/groups.ts";

const DEFAULTS: Record<string, { keywords: string[]; intro: string }> = {
  맛집: { keywords: ["맛집", "식당", "밥집", "restaurant", "where to eat", "food"], intro: "근처에 이런 맛집들이 있어요!" },
  한식: { keywords: ["한식", "한국 음식", "korean food", "korean restaurant", "bbq", "삼겹살"], intro: "한국 음식 드셔 보고 싶다면 여기 추천드려요!" },
  아침: { keywords: ["아침", "브런치", "breakfast", "brunch", "morning"], intro: "아침 일찍 여는 곳이에요!" },
  야식: { keywords: ["야식", "밤늦게", "late night", "midnight", "open late"], intro: "늦게까지 하는 곳이에요!" },
  카페: { keywords: ["카페", "커피", "cafe", "coffee", "디저트", "dessert"], intro: "근처 카페 추천드려요!" },
  술집: { keywords: ["술집", "술 한잔", "bar", "pub", "drink", "beer"], intro: "한잔하기 좋은 곳이에요!" },
};

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let propertyId = process.argv[2];
if (!propertyId) {
  const { data } = await admin.from("properties").select("id").order("created_at").limit(1).single();
  propertyId = data!.id as string;
}
const { data: places } = await admin.from("food_places").select("*").eq("property_id", propertyId);
const { data: existing } = await admin.from("food_groups").select("name").eq("property_id", propertyId);
const have = new Set((existing ?? []).map((g) => g.name as string));

let order = have.size;
for (const s of SITUATIONS) {
  if (have.has(s.label)) {
    console.log(`- ${s.label}: 이미 있음, 건너뜀`);
    continue;
  }
  const top = ((places ?? []) as (FoodPlace & { id: string })[])
    .filter((p) => p.situation === s.key && !p.hidden)
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 5);
  if (top.length === 0) continue;
  const d = DEFAULTS[s.label];
  const { data: g, error } = await admin
    .from("food_groups")
    .insert({ property_id: propertyId, name: s.label, intro: d.intro, keywords: d.keywords, sort_order: order++ })
    .select("*")
    .single();
  if (error || !g) throw new Error(error?.message);
  const rows = top.map((p, i) => ({ group_id: g.id, food_place_id: p.id, sort_order: i }));
  const { data: items } = await admin.from("food_group_items").insert(rows).select("*");
  await admin.from("airbnb_reply_rules").insert(groupRule(g as FoodGroup));
  console.log(`\n[${s.label}] 키워드: ${d.keywords.join(", ")}`);
  console.log(renderGroup(g as FoodGroup, (items ?? []) as FoodGroupItem[], (places ?? []) as FoodPlace[], "ko"));
}

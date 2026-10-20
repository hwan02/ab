/**
 * 숙소 주변 맛집 자동 수집.
 *
 * POST /api/food/collect  { propertyId }
 *   인증: 숙소 소유 호스트 세션.
 *   1) 숙소 좌표가 없으면 주소로 Places Text Search 해 좌표를 저장
 *   2) Places Nearby Search(New) 를 검색 4종 × 한/영 2회 = 8번 호출
 *   3) 상황별(맛집·한식·아침·야식·카페·술집)로 분류해 food_places 에 upsert
 *      - 기존 행의 호스트 메모·숨김·순서는 유지하고, 이름·평점·영업시간만 갱신
 *
 * 비용(2026-10 기준, Google 무료 한도 월별·SKU별):
 *   Nearby Search Enterprise(영업시간·평점 필드) 월 1,000건 무료 → 수집 1회 8건 → 월 약 125회 무료.
 *   Text Search Pro(좌표) 월 5,000건 무료, 숙소당 최초 1회.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classify, FIELD_MASK, RADIUS_M, SEARCHES, type GPlace } from "@/lib/food/places";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

async function places(path: "searchNearby" | "searchText", body: unknown, fieldMask: string) {
  const res = await fetch(`https://places.googleapis.com/v1/places:${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY!, "X-Goog-FieldMask": fieldMask },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { places?: GPlace[]; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message?.split(".")[0] ?? `Places API ${res.status}`);
  return json.places ?? [];
}

export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: "Google Maps 키가 설정되지 않았습니다." }, { status: 503 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { propertyId } = (await req.json().catch(() => ({}))) as { propertyId?: string };
  if (!propertyId) return NextResponse.json({ error: "propertyId required" }, { status: 400 });

  const { data: property } = await supabase
    .from("properties")
    .select("id, host_id, address, latitude, longitude")
    .eq("id", propertyId)
    .maybeSingle();
  if (!property || property.host_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  try {
    // 1) 좌표
    let lat = property.latitude as number | null;
    let lng = property.longitude as number | null;
    if (lat == null || lng == null) {
      if (!property.address) return NextResponse.json({ error: "숙소 주소를 먼저 입력해 주세요." }, { status: 422 });
      const found = await places("searchText", { textQuery: property.address, languageCode: "ko", maxResultCount: 1 }, "places.location");
      const loc = found[0]?.location;
      if (!loc) return NextResponse.json({ error: "주소로 위치를 찾지 못했습니다." }, { status: 422 });
      lat = loc.latitude;
      lng = loc.longitude;
      await admin.from("properties").update({ latitude: lat, longitude: lng }).eq("id", propertyId);
    }

    // 2) 주변 검색 (한국어 + 영어 이름)
    const nearby = (includedTypes: string[], languageCode: string) =>
      places(
        "searchNearby",
        {
          includedTypes,
          maxResultCount: 20,
          rankPreference: "POPULARITY",
          languageCode,
          locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: RADIUS_M } },
        },
        languageCode === "ko" ? FIELD_MASK : "places.id,places.displayName"
      );
    const ko = await Promise.all(SEARCHES.map((s) => nearby(s.includedTypes, "ko")));
    const en = await Promise.all(SEARCHES.map((s) => nearby(s.includedTypes, "en")));
    const results = Object.fromEntries(SEARCHES.map((s, i) => [s.key, ko[i]])) as Record<(typeof SEARCHES)[number]["key"], GPlace[]>;
    const enNames = new Map<string, string>();
    en.flat().forEach((p) => p.displayName?.text && enNames.set(p.id, p.displayName.text));

    // 3) 분류 + 저장 (호스트 편집값 유지)
    const rows = classify(results, enNames, { lat: lat!, lng: lng! });
    const { data: existing } = await admin
      .from("food_places")
      .select("situation, google_place_id")
      .eq("property_id", propertyId)
      .not("google_place_id", "is", null);
    const have = new Set((existing ?? []).map((r) => `${r.situation}|${r.google_place_id}`));
    const now = new Date().toISOString();

    let added = 0;
    let updated = 0;
    for (const r of rows) {
      const key = `${r.situation}|${r.google_place_id}`;
      const fresh = {
        name: r.name,
        name_en: r.name_en,
        category: r.category,
        walk_minutes: r.walk_minutes,
        rating: r.rating,
        rating_count: r.rating_count,
        hours_note: r.hours_note,
        hours_note_en: r.hours_note_en,
        maps_url: r.maps_url,
        collected_at: now,
      };
      if (have.has(key)) {
        await admin.from("food_places").update(fresh).eq("property_id", propertyId).eq("situation", r.situation).eq("google_place_id", r.google_place_id);
        updated += 1;
      } else {
        // 새로 들어온 곳은 기존 목록 뒤에 붙인다
        await admin.from("food_places").insert({ ...fresh, property_id: propertyId, situation: r.situation, google_place_id: r.google_place_id, sort_order: 100 + r.sort_order });
        added += 1;
      }
    }
    return NextResponse.json({ added, updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const disabled = /has not been used|is disabled|PERMISSION_DENIED/i.test(message);
    return NextResponse.json(
      { error: disabled ? "Google 프로젝트에서 Places API (New) 를 켜야 합니다." : `수집 실패: ${message}` },
      { status: disabled ? 503 : 502 }
    );
  }
}

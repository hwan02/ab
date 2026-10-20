import type { SupabaseClient } from "@supabase/supabase-js";
import { classify, FIELD_MASK, RADIUS_M, SEARCHES, type GPlace } from "./places.ts";

/**
 * 숙소 주변 맛집을 Google Places (New) 로 수집해 food_places 에 저장한다(서비스 롤 클라이언트로 호출).
 * 좌표가 없으면 주소로 찾아 properties 에 저장. 기존 행의 호스트 메모·숨김·순서는 유지.
 * 비용: Nearby Search 8건(+최초 1회 Text Search 1건) + 새로 들어온 가게 사진(가게당 1장, 이후 재사용).
 */
export async function collectFood(admin: SupabaseClient, propertyId: string, apiKey: string): Promise<{ added: number; updated: number; photos: number }> {
  const places = async (path: "searchNearby" | "searchText", body: unknown, fieldMask: string) => {
    const res = await fetch(`https://places.googleapis.com/v1/places:${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fieldMask },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { places?: GPlace[]; error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message?.split(".")[0] ?? `Places API ${res.status}`);
    return json.places ?? [];
  };

  const { data: property, error } = await admin.from("properties").select("id, address, latitude, longitude").eq("id", propertyId).maybeSingle();
  if (error || !property) throw new Error("숙소를 찾지 못했습니다.");

  let lat = property.latitude as number | null;
  let lng = property.longitude as number | null;
  if (lat == null || lng == null) {
    if (!property.address) throw new Error("숙소 주소를 먼저 입력해 주세요.");
    const found = await places("searchText", { textQuery: property.address, languageCode: "ko", maxResultCount: 1 }, "places.location");
    const loc = found[0]?.location;
    if (!loc) throw new Error("주소로 위치를 찾지 못했습니다.");
    lat = loc.latitude;
    lng = loc.longitude;
    await admin.from("properties").update({ latitude: lat, longitude: lng }).eq("id", propertyId);
  }

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

  const rows = classify(results, enNames, { lat: lat!, lng: lng! });
  const { data: existing } = await admin.from("food_places").select("situation, google_place_id, photo_url").eq("property_id", propertyId).not("google_place_id", "is", null);
  // 같은 가게는 상황이 달라도 사진 1장만 받는다. 이미 저장된 사진은 다시 받지 않는다.
  const photoByPlace = new Map<string, string>();
  (existing ?? []).forEach((r) => r.photo_url && photoByPlace.set(r.google_place_id as string, r.photo_url as string));
  let photos = 0;
  const photoFor = async (placeId: string, photoName: string | null): Promise<string | null> => {
    if (photoByPlace.has(placeId)) return photoByPlace.get(placeId)!;
    if (!photoName) return null;
    try {
      const img = await fetch(`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=480&key=${apiKey}`);
      if (!img.ok) return null;
      const type = img.headers.get("content-type") ?? "image/jpeg";
      const path = `food/${propertyId}/${placeId}.${type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg"}`;
      const { error: upErr } = await admin.storage.from("property-photos").upload(path, Buffer.from(await img.arrayBuffer()), { contentType: type, upsert: true });
      if (upErr) return null;
      photos += 1;
      const url = admin.storage.from("property-photos").getPublicUrl(path).data.publicUrl;
      photoByPlace.set(placeId, url);
      return url;
    } catch {
      return null;
    }
  };
  const have = new Set((existing ?? []).map((r) => `${r.situation}|${r.google_place_id}`));
  const now = new Date().toISOString();

  let added = 0;
  let updated = 0;
  for (const r of rows) {
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
    if (have.has(`${r.situation}|${r.google_place_id}`)) {
      if (!photoByPlace.has(r.google_place_id!) && r.photo_name) {
        const url = await photoFor(r.google_place_id!, r.photo_name);
        if (url) Object.assign(fresh, { photo_url: url });
      }
      await admin.from("food_places").update(fresh).eq("property_id", propertyId).eq("situation", r.situation).eq("google_place_id", r.google_place_id);
      updated += 1;
    } else {
      const photo_url = await photoFor(r.google_place_id!, r.photo_name);
      await admin.from("food_places").insert({ ...fresh, photo_url, property_id: propertyId, situation: r.situation, google_place_id: r.google_place_id, sort_order: 100 + r.sort_order });
      added += 1;
    }
  }
  return { added, updated, photos };
}

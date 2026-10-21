/**
 * 구글 지도 링크로 장소 1곳 추가.
 * 짧은 링크(maps.app.goo.gl)는 따라가서 최종 주소를 얻고, 주소에서 장소 ID·이름·좌표를 읽어
 * Places API (New) 로 가게 정보를 찾아 food_places 에 넣는다(사진 1장 포함).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanMapsUrl, cleanName, FIELD_MASK, hoursNote, walkMinutes, type GPlace, type Situation } from "./places.ts";
import { savePlacePhoto } from "./collect.ts";

export interface ParsedMapsUrl {
  placeId: string | null;
  name: string | null;
  lat: number | null;
  lng: number | null;
}

/** 구글 지도 주소에서 장소 ID·이름·좌표를 읽는다. 순수 함수. */
export function parseMapsUrl(raw: string): ParsedMapsUrl {
  const out: ParsedMapsUrl = { placeId: null, name: null, lat: null, lng: null };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return out;
  }
  // 동의 페이지로 감싼 경우 continue 안의 원래 주소
  const cont = u.searchParams.get("continue");
  if (/consent\./.test(u.hostname) && cont) return parseMapsUrl(cont);

  const q = u.searchParams.get("q") ?? u.searchParams.get("query") ?? "";
  const pid = u.searchParams.get("query_place_id") ?? (q.startsWith("place_id:") ? q.slice(9) : null) ?? u.searchParams.get("place_id");
  if (pid) out.placeId = pid;

  const placeSeg = u.pathname.match(/\/maps\/place\/([^/]+)/);
  if (placeSeg) out.name = decodeURIComponent(placeSeg[1].replace(/\+/g, " "));
  else if (q && !q.startsWith("place_id:") && !/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(q)) out.name = q;

  const full = decodeURIComponent(u.pathname + u.search);
  const d34 = full.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const at = full.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const ll = q.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  const m = d34 ?? at ?? ll;
  if (m) {
    out.lat = Number(m[1]);
    out.lng = Number(m[2]);
  }
  return out;
}

const KIND_SITUATION: [RegExp, Situation][] = [
  [/korean_restaurant/, "korean"],
  [/^(cafe|coffee_shop|bakery|dessert_shop|tea_house)$/, "cafe"],
  [/^(bar|pub|wine_bar|night_club)$/, "bar"],
];

export function situationForTypes(types: string[] = []): Situation {
  for (const [re, s] of KIND_SITUATION) if (types.some((t) => re.test(t))) return s;
  return "best";
}

async function resolveShortLink(url: string): Promise<string> {
  if (!/goo\.gl|maps\.app/i.test(url)) return url;
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
  return res.url || url;
}

export async function addPlaceFromUrl(
  admin: SupabaseClient,
  propertyId: string,
  url: string,
  apiKey: string
): Promise<{ id: string; name: string; existed: boolean }> {
  if (!/^https?:\/\/[^\s]*(google\.[a-z.]+\/maps|maps\.google\.|goo\.gl|maps\.app)/i.test(url.trim())) {
    throw new Error("구글 지도 링크를 넣어 주세요.");
  }
  const finalUrl = await resolveShortLink(url.trim());
  const parsed = parseMapsUrl(finalUrl);

  // ?cid= 링크(가게 번호만 있는 링크)는 이미 목록에 있는 곳만 알아볼 수 있다.
  const cid = (() => {
    try {
      return new URL(finalUrl).searchParams.get("cid");
    } catch {
      return null;
    }
  })();
  if (cid && !parsed.placeId && !parsed.name) {
    const { data: known } = await admin.from("food_places").select("id, name").eq("property_id", propertyId).like("maps_url", `%cid=${cid}%`).limit(1);
    if (known && known.length) return { id: known[0].id as string, name: known[0].name as string, existed: true };
  }

  const { data: property } = await admin.from("properties").select("latitude, longitude").eq("id", propertyId).maybeSingle();
  const origin = property?.latitude != null ? { lat: property.latitude as number, lng: property.longitude as number } : null;

  const headers = { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey };
  let place: GPlace | null = null;
  if (parsed.placeId) {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(parsed.placeId)}?languageCode=ko`, {
      headers: { ...headers, "X-Goog-FieldMask": FIELD_MASK.replace(/places\./g, "") },
    });
    if (res.ok) place = (await res.json()) as GPlace;
  }
  if (!place && parsed.name) {
    const center = parsed.lat != null ? { latitude: parsed.lat, longitude: parsed.lng } : origin ? { latitude: origin.lat, longitude: origin.lng } : null;
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { ...headers, "X-Goog-FieldMask": FIELD_MASK },
      body: JSON.stringify({
        textQuery: parsed.name,
        languageCode: "ko",
        maxResultCount: 1,
        ...(center ? { locationBias: { circle: { center, radius: 1000 } } } : {}),
      }),
    });
    const json = (await res.json()) as { places?: GPlace[]; error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message?.split(".")[0] ?? "장소 검색 실패");
    place = json.places?.[0] ?? null;
  }
  if (!place?.id || !place.displayName?.text) throw new Error("링크에서 가게를 찾지 못했습니다. 구글 지도에서 가게를 연 뒤 '공유' 링크를 넣어 주세요.");

  const { data: dup } = await admin.from("food_places").select("id, name").eq("property_id", propertyId).eq("google_place_id", place.id).limit(1);
  if (dup && dup.length) return { id: dup[0].id as string, name: dup[0].name as string, existed: true };

  // 영어 이름
  let nameEn: string | null = null;
  const en = await fetch(`https://places.googleapis.com/v1/places/${place.id}?languageCode=en`, { headers: { ...headers, "X-Goog-FieldMask": "displayName" } });
  if (en.ok) nameEn = ((await en.json()) as GPlace).displayName?.text ?? null;

  const h = hoursNote(place);
  const photo = place.photos?.[0]?.name ? await savePlacePhoto(admin, apiKey, propertyId, place.id, place.photos[0].name) : null;
  const { data: row, error } = await admin
    .from("food_places")
    .insert({
      property_id: propertyId,
      situation: situationForTypes(place.types),
      google_place_id: place.id,
      name: cleanName(place.displayName.text),
      name_en: nameEn ? cleanName(nameEn) : null,
      category: place.primaryTypeDisplayName?.text ?? null,
      walk_minutes: origin && place.location ? walkMinutes(origin, place.location) : null,
      rating: place.rating ?? null,
      rating_count: place.userRatingCount ?? null,
      hours_note: h.ko,
      hours_note_en: h.en,
      maps_url: cleanMapsUrl(place.googleMapsUri),
      photo_url: photo,
      sort_order: -1,
      collected_at: new Date().toISOString(),
    })
    .select("id, name")
    .single();
  if (error || !row) throw new Error("저장 실패: " + (error?.message ?? ""));
  return { id: row.id as string, name: row.name as string, existed: false };
}

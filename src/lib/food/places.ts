/**
 * 숙소 주변 맛집: 상황 정의, Google Places 결과 → 상황별 분류, 영업시간 요약, 답장용 목록 렌더링.
 * 순수 함수만 둔다(수집 라우트·자동응답·미리보기·테스트에서 공용).
 */

export type Situation = "best" | "korean" | "breakfast" | "latenight" | "cafe" | "bar";
export type Lang = "ko" | "en" | "zh" | "ja";

export const SITUATIONS: { key: Situation; label: string; en: string }[] = [
  { key: "best", label: "맛집", en: "Popular restaurants" },
  { key: "korean", label: "한식", en: "Korean food" },
  { key: "breakfast", label: "아침", en: "Breakfast" },
  { key: "latenight", label: "야식", en: "Late night" },
  { key: "cafe", label: "카페", en: "Cafes" },
  { key: "bar", label: "술집", en: "Bars" },
];

/** 답변에 넣는 변수: {맛집:야식} */
export const FOOD_VARIABLES = SITUATIONS.map((s) => `{맛집:${s.label}}`);
const FOOD_TOKEN_RE = /\{맛집:([^}]+)\}/g;

export function situationByLabel(label: string): Situation | null {
  return SITUATIONS.find((s) => s.label === label.trim())?.key ?? null;
}

export interface FoodPlace {
  id?: string;
  situation: Situation;
  google_place_id: string | null;
  name: string;
  name_en: string | null;
  category: string | null;
  walk_minutes: number | null;
  rating: number | null;
  rating_count: number | null;
  hours_note: string | null;
  hours_note_en: string | null;
  maps_url: string | null;
  photo_url?: string | null;
  note: string | null;
  sort_order: number;
  hidden: boolean;
}

// ---------------------------------------------------------------------------
// Google Places (New) 응답
// ---------------------------------------------------------------------------

export interface GPeriodPoint {
  day: number; // 0 = 일요일
  hour: number;
  minute: number;
}
export interface GPlace {
  id: string;
  displayName?: { text: string };
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  location?: { latitude: number; longitude: number };
  googleMapsUri?: string;
  regularOpeningHours?: { periods?: { open: GPeriodPoint; close?: GPeriodPoint }[] };
  businessStatus?: string;
  photos?: { name: string }[];
}

/** 수집 때 부르는 검색 묶음. 아침·야식은 이 결과들의 영업시간으로 고른다. */
export const SEARCHES: { key: "restaurant" | "korean" | "cafe" | "bar"; includedTypes: string[] }[] = [
  { key: "restaurant", includedTypes: ["restaurant"] },
  { key: "korean", includedTypes: ["korean_restaurant"] },
  { key: "cafe", includedTypes: ["cafe", "coffee_shop", "bakery"] },
  { key: "bar", includedTypes: ["bar", "pub", "wine_bar"] },
];

export const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.rating",
  "places.userRatingCount",
  "places.location",
  "places.googleMapsUri",
  "places.regularOpeningHours.periods",
  "places.businessStatus",
  "places.photos",
].join(",");

export const RADIUS_M = 1200; // 도보 15분 남짓

export function walkMinutes(from: { lat: number; lng: number }, to: { latitude: number; longitude: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.lat);
  const dLng = toRad(to.longitude - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;
  const meters = 2 * R * Math.asin(Math.sqrt(a));
  // 직선거리에 골목 보정 1.3배, 분당 80m
  return Math.max(1, Math.round((meters * 1.3) / 80));
}

/** 하루 기준 분(0~1440+) 으로 바꾼 영업 구간들. 자정을 넘기면 close 가 1440 이상. */
function intervals(p: GPlace): { open: number; close: number }[] | "24h" | null {
  const periods = p.regularOpeningHours?.periods;
  if (!periods || periods.length === 0) return null;
  if (periods.length === 1 && !periods[0].close) return "24h";
  return periods
    .filter((x) => x.close)
    .map((x) => {
      const open = x.open.hour * 60 + x.open.minute;
      let close = x.close!.hour * 60 + x.close!.minute;
      if (x.close!.day !== x.open.day || close <= open) close += 1440;
      return { open, close };
    });
}

export function isLateNight(p: GPlace): boolean {
  const iv = intervals(p);
  if (iv === "24h") return true;
  if (!iv) return false;
  return iv.some((x) => x.close >= 23 * 60);
}

export function isBreakfast(p: GPlace): boolean {
  const iv = intervals(p);
  if (iv === "24h") return true;
  if (!iv) return false;
  return iv.some((x) => x.open <= 9 * 60 && x.open >= 5 * 60);
}

const hhmm = (min: number, isClose: boolean) => {
  const t = isClose && min % 1440 === 0 ? 1440 : min % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/**
 * 영업시간 한 줄: "17:00-02:00". 요일마다 다르면 가장 많은 요일의 시간대를 쓴다. 24시간 영업은 "24시간".
 * (상황 인자는 예전 호출 호환용)
 */
export function hoursNote(p: GPlace, _situation?: Situation): { ko: string | null; en: string | null } {
  const iv = intervals(p);
  if (iv === "24h") return { ko: "24시간", en: "Open 24h" };
  if (!iv || iv.length === 0) return { ko: null, en: null };
  // 같은 요일의 여러 구간(브레이크 타임)은 첫 오픈~마지막 마감으로 합친다.
  const periods = p.regularOpeningHours?.periods ?? [];
  const byDay = new Map<number, { open: number; close: number }>();
  periods.forEach((x, k) => {
    const seg = iv[k];
    if (!seg || !x.close) return;
    const cur = byDay.get(x.open.day);
    byDay.set(x.open.day, cur ? { open: Math.min(cur.open, seg.open), close: Math.max(cur.close, seg.close) } : seg);
  });
  const days = byDay.size ? [...byDay.values()] : iv;
  const counts = new Map<string, number>();
  for (const x of days) {
    // 다음날 아침 6시 이후까지 하는 곳은 "익일"을 붙여 헷갈리지 않게 (예: 11:00-익일 10:00)
    const nextDay = x.close > 1440 && x.close - 1440 >= 6 * 60;
    const key = `${hhmm(x.open, false)}-${nextDay ? "익일 " : ""}${hhmm(x.close, true)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return { ko: best, en: best };
}

/**
 * 검색 결과들(한국어/영어 이름)을 상황별 후보로 나눈다. 상황마다 평점·리뷰 수로 정렬해 최대 limit 개.
 * 리뷰가 너무 적은(< 20) 곳과 영업 중이 아닌 곳은 뺀다.
 */
export function classify(
  results: Record<"restaurant" | "korean" | "cafe" | "bar", GPlace[]>,
  enNames: Map<string, string>,
  origin: { lat: number; lng: number },
  limit = 10
): (Omit<FoodPlace, "note" | "hidden"> & { photo_name: string | null })[] {
  const ok = (p: GPlace) => (p.businessStatus ?? "OPERATIONAL") === "OPERATIONAL" && (p.userRatingCount ?? 0) >= 20 && !!p.displayName?.text;
  const score = (p: GPlace) => (p.rating ?? 0) * Math.log10(10 + (p.userRatingCount ?? 0));
  const allFood = dedupe([...results.restaurant, ...results.korean]).filter(ok);
  const pick: Record<Situation, GPlace[]> = {
    best: allFood,
    korean: results.korean.filter(ok),
    breakfast: dedupe([...allFood, ...results.cafe.filter(ok)]).filter(isBreakfast),
    latenight: dedupe([...allFood, ...results.bar.filter(ok)]).filter(isLateNight),
    cafe: results.cafe.filter(ok),
    bar: results.bar.filter(ok),
  };
  const out: (Omit<FoodPlace, "note" | "hidden"> & { photo_name: string | null })[] = [];
  for (const { key } of SITUATIONS) {
    const sorted = [...pick[key]].sort((a, b) => score(b) - score(a)).slice(0, limit);
    sorted.forEach((p, i) => {
      const h = hoursNote(p, key);
      out.push({
        situation: key,
        google_place_id: p.id,
        name: cleanName(p.displayName!.text),
        name_en: enNames.has(p.id) ? cleanName(enNames.get(p.id)!) : null,
        category: p.primaryTypeDisplayName?.text ?? null,
        walk_minutes: p.location ? walkMinutes(origin, p.location) : null,
        rating: p.rating ?? null,
        rating_count: p.userRatingCount ?? null,
        hours_note: h.ko,
        hours_note_en: h.en,
        maps_url: p.googleMapsUri ?? null,
        photo_name: p.photos?.[0]?.name ?? null,
        sort_order: i,
      });
    });
  }
  return out;
}

/** "연남동 히포 | Hippo Brunchhaus | 延南洞…" 처럼 여러 언어를 이어 붙인 이름은 첫 이름만. */
export function cleanName(name: string): string {
  return name.split(/\s+\|\s+/)[0].trim();
}

function dedupe(list: GPlace[]): GPlace[] {
  const seen = new Set<string>();
  return list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

// ---------------------------------------------------------------------------
// 답장용 목록
// ---------------------------------------------------------------------------

export const FOOD_LIST_SIZE = 5;

/**
 * 한 상황의 목록을 답장 문장으로. links 가 문자열(사이트 주소)이면 짧은 지도 링크(<사이트>/m/<장소 id>)를,
 * true 면 구글 지도 주소를 줄 아래에 붙인다. 예약 확정 전 게스트에게는 링크를 넣지 않는다(false).
 */
export function renderFoodList(places: FoodPlace[], lang: Lang, size = FOOD_LIST_SIZE, links: boolean | string = false): string {
  const visible = places.filter((p) => !p.hidden).sort((a, b) => a.sort_order - b.sort_order).slice(0, size);
  if (visible.length === 0) return "";
  const ko = lang === "ko";
  return visible
    .map((p, i) => {
      const name = !ko && p.name_en ? p.name_en : p.name;
      const parts = [name];
      if (p.walk_minutes) parts.push(ko ? `도보 ${p.walk_minutes}분` : `${p.walk_minutes} min walk`);
      if (p.rating) parts.push(`★${Number(p.rating).toFixed(1)}`);
      const hours = ko ? p.hours_note : p.hours_note_en ?? p.hours_note;
      if (hours) parts.push(hours);
      if (p.note && ko) parts.push(p.note);
      const line = `${i + 1}. ${parts.join(" · ")}`;
      const link = typeof links === "string" && links && p.id ? `${links.replace(/\/$/, "")}/m/${p.id}` : links === true ? p.maps_url : null;
      return link ? `${line}\n   ${link}` : line;
    })
    .join("\n");
}

/** 답변 안의 {맛집:상황} 을 목록으로 바꾼다. 해당 상황 목록이 비어 있으면 그 변수만 지운다. */
export function fillFoodVariables(text: string, places: FoodPlace[], lang: Lang, links: boolean | string = false): string {
  return text
    .replace(FOOD_TOKEN_RE, (_m, label: string) => {
      const key = situationByLabel(label);
      if (!key) return "";
      return renderFoodList(
        places.filter((p) => p.situation === key),
        lang,
        FOOD_LIST_SIZE,
        links
      );
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hasFoodVariable(text: string): boolean {
  return /\{맛집:[^}]+\}/.test(text);
}

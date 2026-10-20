import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, fillFoodVariables, hoursNote, isBreakfast, isLateNight, renderFoodList, walkMinutes, type FoodPlace, type GPlace } from "./places.ts";

const pt = (day: number, hour: number, minute = 0) => ({ day, hour, minute });
const place = (id: string, over: Partial<GPlace> = {}): GPlace => ({
  id,
  displayName: { text: id },
  rating: 4.5,
  userRatingCount: 100,
  location: { latitude: 37.5665, longitude: 126.932 },
  businessStatus: "OPERATIONAL",
  ...over,
});

test("영업시간: 자정 넘는 마감은 야식, 9시 이전 오픈은 아침, 24시간은 둘 다", () => {
  const night = place("n", { regularOpeningHours: { periods: [{ open: pt(1, 18), close: pt(2, 2) }] } });
  const day = place("d", { regularOpeningHours: { periods: [{ open: pt(1, 11), close: pt(1, 21) }] } });
  const morning = place("m", { regularOpeningHours: { periods: [{ open: pt(1, 7), close: pt(1, 15) }] } });
  const allday = place("a", { regularOpeningHours: { periods: [{ open: pt(0, 0) }] } });
  assert.equal(isLateNight(night), true);
  assert.equal(isLateNight(day), false);
  assert.equal(isBreakfast(morning), true);
  assert.equal(isBreakfast(day), false);
  assert.equal(isLateNight(allday), true);
  assert.equal(isBreakfast(allday), true);
  assert.deepEqual(hoursNote(night, "latenight"), { ko: "새벽 2시까지", en: "Until 2am" });
  assert.deepEqual(hoursNote(morning, "breakfast"), { ko: "아침 7시 오픈", en: "Opens 7am" });
  assert.deepEqual(hoursNote(allday, "latenight"), { ko: "24시간", en: "Open 24h" });
});

test("시간 표기: 자정·새벽·다음날 아침·저녁", () => {
  const closeAt = (openDay: number, closeDay: number, h: number, m = 0) => place("x", { regularOpeningHours: { periods: [{ open: pt(openDay, 17), close: pt(closeDay, h, m) }] } });
  assert.equal(hoursNote(closeAt(1, 2, 0), "latenight").ko, "밤 12시까지");
  assert.equal(hoursNote(closeAt(1, 2, 2), "latenight").ko, "새벽 2시까지");
  assert.equal(hoursNote(closeAt(1, 2, 10), "latenight").ko, "다음날 아침 10시까지");
  assert.equal(hoursNote(closeAt(1, 1, 19), "best").ko, "저녁 7시까지");
  assert.equal(hoursNote(closeAt(1, 1, 22, 30), "best").ko, "밤 10시 30분까지");
});

test("cleanName 은 '|' 로 이은 다국어 이름에서 첫 이름만", async () => {
  const { cleanName } = await import("./places.ts");
  assert.equal(cleanName("연남동 히포 브런치하우스 | Yeonnam Brunch Cafe Hippo | 延南洞早午餐"), "연남동 히포 브런치하우스");
  assert.equal(cleanName("White Rabbit"), "White Rabbit");
});

test("walkMinutes 는 직선거리에 골목 보정을 해 분으로", () => {
  const m = walkMinutes({ lat: 37.5665, lng: 126.932 }, { latitude: 37.5665, longitude: 126.9408 });
  assert.ok(m >= 10 && m <= 14, `got ${m}`);
});

test("classify: 리뷰 적은 곳·폐업 제외, 상황별 평점순, 영어 이름", () => {
  const results = {
    restaurant: [
      place("good", { rating: 4.7, userRatingCount: 500, regularOpeningHours: { periods: [{ open: pt(1, 17), close: pt(2, 1) }] } }),
      place("few", { userRatingCount: 3 }),
      place("closed", { businessStatus: "CLOSED_PERMANENTLY" }),
    ],
    korean: [place("kimchi", { rating: 4.2, userRatingCount: 80, regularOpeningHours: { periods: [{ open: pt(1, 7), close: pt(1, 14) }] } })],
    cafe: [place("cafe1")],
    bar: [],
  };
  const out = classify(results, new Map([["good", "Good Place"]]), { lat: 37.5665, lng: 126.932 });
  const by = (s: string) => out.filter((p) => p.situation === s).map((p) => p.google_place_id);
  assert.deepEqual(by("best"), ["good", "kimchi"]);
  assert.deepEqual(by("korean"), ["kimchi"]);
  assert.deepEqual(by("latenight"), ["good"]);
  assert.deepEqual(by("breakfast"), ["kimchi"]);
  assert.deepEqual(by("cafe"), ["cafe1"]);
  assert.equal(out.find((p) => p.google_place_id === "good")?.name_en, "Good Place");
});

const fp = (over: Partial<FoodPlace>): FoodPlace => ({
  situation: "latenight",
  google_place_id: null,
  name: "포차",
  name_en: "Pocha",
  category: null,
  walk_minutes: 5,
  rating: 4.4,
  rating_count: 100,
  hours_note: "새벽 2시까지",
  hours_note_en: "Until 2am",
  maps_url: "https://maps.google.com/x",
  note: null,
  sort_order: 0,
  hidden: false,
  ...over,
});

test("renderFoodList: 숨긴 곳 제외, 순서대로, 언어별, 링크 없음", () => {
  const list = [fp({ name: "B", name_en: "B-en", sort_order: 1 }), fp({ name: "A", sort_order: 0, note: "줄 김" }), fp({ name: "X", hidden: true })];
  assert.equal(renderFoodList(list, "ko"), "1. A · 도보 5분 · ★4.4 · 새벽 2시까지 · 줄 김\n2. B · 도보 5분 · ★4.4 · 새벽 2시까지");
  assert.equal(renderFoodList(list, "en"), "1. Pocha · 5 min walk · ★4.4 · Until 2am\n2. B-en · 5 min walk · ★4.4 · Until 2am");
  assert.doesNotMatch(renderFoodList(list, "ko"), /https?:/);
});

test("fillFoodVariables: {맛집:야식} 을 목록으로, 모르는 상황·빈 목록은 지운다", () => {
  const places = [fp({ name: "A" })];
  assert.equal(fillFoodVariables("야식 추천드려요!\n{맛집:야식}", places, "ko"), "야식 추천드려요!\n1. A · 도보 5분 · ★4.4 · 새벽 2시까지");
  assert.equal(fillFoodVariables("추천\n{맛집:카페}", places, "ko"), "추천");
  assert.equal(fillFoodVariables("추천 {맛집:없는상황}", places, "ko"), "추천");
});

test("renderFoodList/fillFoodVariables: links=true 면 지도 링크를 줄 아래에", () => {
  const list = [fp({ name: "A", maps_url: "https://maps.google.com/a" })];
  assert.equal(renderFoodList(list, "ko", 5, true), "1. A · 도보 5분 · ★4.4 · 새벽 2시까지\n   https://maps.google.com/a");
  assert.match(fillFoodVariables("{맛집:야식}", list, "ko", true), /maps\.google\.com\/a/);
  assert.doesNotMatch(fillFoodVariables("{맛집:야식}", list, "ko"), /https?:/);
});

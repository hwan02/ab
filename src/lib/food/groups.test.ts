import { test } from "node:test";
import assert from "node:assert/strict";
import { fillGroupVariables, groupRule, renderGroup, reorder, type FoodGroup, type FoodGroupItem } from "./groups.ts";
import type { FoodPlace } from "./places.ts";

const place = (id: string, name: string, over: Partial<FoodPlace> = {}): FoodPlace => ({
  id,
  situation: "best",
  google_place_id: id,
  name,
  name_en: `${name}-en`,
  category: null,
  walk_minutes: 5,
  rating: 4.5,
  rating_count: 100,
  hours_note: null,
  hours_note_en: null,
  maps_url: `https://maps/${id}`,
  note: null,
  sort_order: 0,
  hidden: false,
  ...over,
});

const group: FoodGroup = { id: "g1", property_id: "p", name: "비 오는 날", intro: "비 오는 날엔 실내가 좋아요!", keywords: ["비", "rain"], sort_order: 0 };
const items: FoodGroupItem[] = [
  { id: "i2", group_id: "g1", food_place_id: "b", note: null, sort_order: 1 },
  { id: "i1", group_id: "g1", food_place_id: "a", note: "고양이 카페", sort_order: 0 },
];
const places = [place("a", "A카페"), place("b", "B서점")];

test("renderGroup: 문구 + 순서대로, 항목 메모 우선", () => {
  assert.equal(renderGroup(group, items, places, "ko"), "비 오는 날엔 실내가 좋아요!\n1. A카페 · 도보 5분 · ★4.5 · 고양이 카페\n2. B서점 · 도보 5분 · ★4.5");
});

test("renderGroup: 영어는 영어 이름, 문구는 한국어일 때만", () => {
  assert.equal(renderGroup(group, items, places, "en"), "1. A카페-en · 5 min walk · ★4.5\n2. B서점-en · 5 min walk · ★4.5");
});

test("fillGroupVariables: {장소:그룹} 치환, 없는 그룹은 지움, links 는 지도 링크", () => {
  assert.match(fillGroupVariables("{장소:비 오는 날}", [group], items, places, "ko"), /^비 오는 날엔/);
  assert.equal(fillGroupVariables("안내\n{장소:없음}", [group], items, places, "ko"), "안내");
  assert.match(fillGroupVariables("{장소:비 오는 날}", [group], items, places, "ko", true), /https:\/\/maps\/a/);
});

test("groupRule: 키워드 없으면 꺼진 규칙", () => {
  assert.deepEqual(groupRule(group), { property_id: "p", food_group_id: "g1", name: "장소 · 비 오는 날", keywords: ["비", "rain"], answer: "{장소:비 오는 날}", enabled: true });
  assert.equal(groupRule({ ...group, keywords: [] }).enabled, false);
});

test("reorder: 드래그한 항목을 새 위치로", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(reorder(list, "c", 0).map((x) => x.id), ["c", "a", "b"]);
  assert.deepEqual(reorder(list, "a", 2).map((x) => x.id), ["b", "c", "a"]);
  assert.deepEqual(reorder(list, "zz", 0), list);
});

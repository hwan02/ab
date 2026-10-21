import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMapsUrl, situationForTypes } from "./addFromUrl.ts";

test("parseMapsUrl: /maps/place/이름/@좌표 형태", () => {
  const p = parseMapsUrl("https://www.google.com/maps/place/%EB%A7%8C%EB%8F%99%EC%A0%9C%EA%B3%BC+%EC%97%B0%EB%82%A8%EC%A0%90/@37.5612,126.9255,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d37.5613!4d126.9256");
  assert.equal(p.name, "만동제과 연남점");
  assert.equal(p.lat, 37.5613);
  assert.equal(p.lng, 126.9256);
});

test("parseMapsUrl: query_place_id / q=place_id", () => {
  assert.equal(parseMapsUrl("https://www.google.com/maps/search/?api=1&query=abc&query_place_id=ChIJ123").placeId, "ChIJ123");
  assert.equal(parseMapsUrl("https://maps.google.com/?q=place_id:ChIJ999").placeId, "ChIJ999");
});

test("parseMapsUrl: q=이름 과 q=좌표", () => {
  assert.equal(parseMapsUrl("https://maps.google.com/?q=%EC%BD%94%EB%A6%AC%EC%BD%94+%EC%B9%B4%ED%8E%98").name, "코리코 카페");
  const c = parseMapsUrl("https://maps.google.com/?q=37.56,126.93");
  assert.equal(c.name, null);
  assert.equal(c.lat, 37.56);
});

test("parseMapsUrl: 동의 페이지 continue 안의 주소", () => {
  const inner = encodeURIComponent("https://www.google.com/maps/place/White+Rabbit/@37.55,126.92,17z");
  assert.equal(parseMapsUrl(`https://consent.google.com/m?continue=${inner}`).name, "White Rabbit");
});

test("situationForTypes", () => {
  assert.equal(situationForTypes(["korean_restaurant", "restaurant"]), "korean");
  assert.equal(situationForTypes(["coffee_shop"]), "cafe");
  assert.equal(situationForTypes(["pub"]), "bar");
  assert.equal(situationForTypes(["italian_restaurant"]), "best");
});

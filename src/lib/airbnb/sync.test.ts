import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeHashtagTitle, matchProperty, twinKey } from "./sync.ts";

const p = (id: string, name: string, title: string | null = null) => ({ id, name, airbnb_listing_title: title });

test("숙소가 하나뿐이어도 제목이 안 맞으면 매핑하지 않는다", () => {
  const only = p("a", "홍대점", "#홍대입구역 #최대6인 #짐보관");
  assert.equal(matchProperty("#강남역 #최대2인 #신축", [only]).property, null);
  assert.equal(matchProperty(null, [only]).reason, "no_listing");
  assert.equal(matchProperty("   ", [only]).reason, "no_listing");
});

test("정규화 완전 일치 (대소문자·공백 무시)", () => {
  const a = p("a", "홍대점", "#홍대입구역 #최대6인 #짐보관");
  const b = p("b", "강남점", "#강남역 #최대2인");
  const m = matchProperty("#홍대입구역  #최대6인 #짐보관 ", [b, a]);
  assert.equal(m.property?.id, "a");
  assert.equal(m.reason, "exact");
});

test("포함 매칭: 긴 쪽이 이기고, 같은 길이면 미확정", () => {
  const short = p("s", "짧은", "#홍대입구역");
  const long = p("l", "긴", "#홍대입구역 #최대6인");
  const m = matchProperty("#홍대입구역 #최대6인 #짐보관 #신축", [short, long]);
  assert.equal(m.property?.id, "l");
  assert.equal(m.reason, "contains");

  const dup1 = p("1", "하나", "#홍대입구역 #최대6인");
  const dup2 = p("2", "둘", "#홍대입구역 #최대6인");
  const tie = matchProperty("#홍대입구역 #최대6인 #짐보관", [dup1, dup2]);
  assert.equal(tie.property, null);
  assert.equal(tie.reason, "ambiguous");
  assert.deepEqual(tie.candidates.map((c) => c.id).sort(), ["1", "2"]);
});

test("해시태그 2개 이상 겹치면 최고 점수, 동점이면 미확정", () => {
  const a = p("a", "A", "#홍대입구역 #최대6인 #짐보관 #루프탑");
  const b = p("b", "B", "#홍대입구역 #최대2인 #신축");
  const c = p("c", "C", "#강남역 #최대4인");
  // 제목이 바뀌어 포함 관계는 아니지만 태그 3개가 A 와 겹친다
  const m = matchProperty("#루프탑 #홍대입구역 #짐보관 #조용한", [c, b, a]);
  assert.equal(m.property?.id, "a");
  assert.equal(m.reason, "tags");

  // 1개만 겹치면 매핑 안 함
  assert.equal(matchProperty("#홍대입구역 #신축오피스텔", [a, c]).property, null);

  const x = p("x", "X", "#홍대입구역 #최대6인 #루프탑");
  const y = p("y", "Y", "#홍대입구역 #최대6인 #신축");
  const tie = matchProperty("#홍대입구역 #최대6인 #조용한", [x, y]);
  assert.equal(tie.property, null);
  assert.equal(tie.reason, "ambiguous");
  assert.equal(tie.candidates.length, 2);
});

test("name 폴백은 리스팅 제목이 비어 있는 숙소에만 적용된다", () => {
  const titled = p("t", "#홍대입구역 #최대6인", "#강남역 #최대2인"); // name 은 메일 제목과 같지만 title 이 있으니 name 은 안 본다
  const untitled = p("u", "#홍대입구역 #최대6인", null);
  const m = matchProperty("#홍대입구역 #최대6인", [titled, untitled]);
  assert.equal(m.property?.id, "u");
  assert.equal(m.reason, "exact");

  // 제목 있는 숙소끼리 미확정이면 name 폴백으로 넘어가지 않는다
  const d1 = p("1", "하나", "#홍대입구역 #최대6인");
  const d2 = p("2", "둘", "#홍대입구역 #최대6인");
  const amb = matchProperty("#홍대입구역 #최대6인", [d1, d2, untitled]);
  assert.equal(amb.reason, "ambiguous");
});

test("아무것도 안 맞으면 none", () => {
  const a = p("a", "홍대점", "#홍대입구역 #최대6인");
  const m = matchProperty("#부산 #해운대 #오션뷰", [a]);
  assert.equal(m.property, null);
  assert.equal(m.reason, "none");
  assert.deepEqual(m.candidates, []);
});

test("twinKey 는 번역 블록을 빼고 본문 앞 200자로 묶는다", () => {
  const a = twinKey("t1", "체크인 몇 시에요?");
  const b = twinKey("t1", "체크인  몇 시에요?\n\n원문에서 자동 번역된 메시지:\n\nWhat time is check-in?");
  assert.equal(a, b);
  assert.equal(twinKey("t1", null), null);
  assert.equal(twinKey(null, "본문"), null);
  assert.notEqual(twinKey("t2", "체크인 몇 시에요?"), a);
});

test("looksLikeHashtagTitle", () => {
  assert.equal(looksLikeHashtagTitle("#홍대입구역 #최대6인"), true);
  assert.equal(looksLikeHashtagTitle("  #홍대"), true);
  assert.equal(looksLikeHashtagTitle("포포스테이 홍대점"), false);
});

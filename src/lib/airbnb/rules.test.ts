import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRule, renderAnswer, pickAnswer, isKoreanOriginal, normalizeForMatch, suggestKeywords, type ReplyRule } from "./rules.ts";

const rule = (over: Partial<ReplyRule>): ReplyRule => ({
  id: "r",
  property_id: "p",
  name: "규칙",
  keywords: [],
  answer: "답",
  answer_en: null,
  priority: 0,
  enabled: true,
  ...over,
});

test("normalizeForMatch 는 대소문자·공백·문장부호를 무시한다", () => {
  assert.equal(normalizeForMatch("Wi-Fi 비밀번호 알려주세요!"), "wifi비밀번호알려주세요");
});

test("키워드 부분 일치로 규칙을 찾는다", () => {
  const wifi = rule({ id: "wifi", keywords: ["와이파이", "wifi", "비밀번호"] });
  const checkin = rule({ id: "checkin", keywords: ["체크인", "입실"] });
  const m = matchRule("안녕하세요 wi-fi 비밀번호가 뭔가요?", [checkin, wifi]);
  assert.equal(m?.rule.id, "wifi");
  assert.deepEqual(m?.matchedKeywords, ["wifi", "비밀번호"]);
});

test("여러 규칙이 걸리면 우선순위, 그다음 걸린 키워드 수로 고른다", () => {
  const a = rule({ id: "a", keywords: ["짐"], priority: 0 });
  const b = rule({ id: "b", keywords: ["체크인", "짐"], priority: 0 });
  const c = rule({ id: "c", keywords: ["체크인"], priority: 5 });
  assert.equal(matchRule("체크인 전에 짐 맡길 수 있나요", [a, b])?.rule.id, "b");
  assert.equal(matchRule("체크인 전에 짐 맡길 수 있나요", [a, b, c])?.rule.id, "c");
});

test("비활성 규칙과 빈 키워드는 무시, 못 찾으면 null", () => {
  const off = rule({ id: "off", keywords: ["주차"], enabled: false });
  const empty = rule({ id: "empty", keywords: ["", "  "] });
  assert.equal(matchRule("주차 되나요", [off, empty]), null);
});

test("renderAnswer 는 변수를 채우고 없는 값은 빈 문자열", () => {
  const out = renderAnswer("{게스트이름}님 안녕하세요! 와이파이는 {와이파이이름} / {와이파이비밀번호} 입니다. {주소}", {
    guestName: "하나",
    wifiSsid: "popostay",
    wifiPassword: "1234",
  });
  assert.equal(out, "하나님 안녕하세요! 와이파이는 popostay / 1234 입니다.");
});

test("원문이 영어면 영어 답변, 한국어면 한국어 답변", () => {
  const r = rule({ answer: "한국어 답", answer_en: "English answer" });
  assert.equal(pickAnswer(r, "여기서 가까운 지하철역은?\n\n원문에서 자동 번역된 메시지:\n\nWhich subway station is close?"), "English answer");
  assert.equal(pickAnswer(r, "체크인 몇 시에요?"), "한국어 답");
  assert.equal(pickAnswer(rule({ answer: "한", answer_en: "" }), "hello there"), "한");
  assert.equal(isKoreanOriginal("请问最近的地铁站"), false);
});

test("suggestKeywords 는 불용어를 빼고 앞에서부터 최대 6개", () => {
  assert.deepEqual(suggestKeywords("안녕하세요 혹시 체크인 전에 짐 보관 되나요?"), ["체크인", "전에", "보관"]);
});

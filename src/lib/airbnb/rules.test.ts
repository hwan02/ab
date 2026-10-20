import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchRule,
  renderAnswer,
  pickAnswer,
  pickAnswerWithLang,
  pickAnswerForLang,
  detectLanguage,
  isKoreanOriginal,
  normalizeForMatch,
  keywordMatches,
  stripTranslationLabel,
  protectVariables,
  restoreVariables,
  suggestKeywords,
  type ReplyRule,
} from "./rules.ts";

const rule = (over: Partial<ReplyRule>): ReplyRule => ({
  id: "r",
  property_id: "p",
  name: "규칙",
  keywords: [],
  answer: "답",
  answer_en: null,
  answer_zh: null,
  answer_ja: null,
  priority: 0,
  enabled: true,
  ...over,
});

const TRANSLATED = (ko: string, original: string) => `${ko}\n\n원문에서 자동 번역된 메시지:\n\n${original}`;

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
  // a 도 1개("짐 맡")는 걸린다. 같은 우선순위면 걸린 키워드 수가 많은 b(2개)가 이긴다.
  const a = rule({ id: "a", keywords: ["짐 맡"], priority: 0 });
  const b = rule({ id: "b", keywords: ["체크인", "짐 맡"], priority: 0 });
  const c = rule({ id: "c", keywords: ["체크인"], priority: 5 });
  const msg = "체크인 전에 짐 맡길 수 있나요";
  assert.deepEqual(matchRule(msg, [a])?.matchedKeywords, ["짐 맡"]);
  assert.equal(matchRule(msg, [a, b])?.rule.id, "b");
  assert.equal(matchRule(msg, [b, a])?.rule.id, "b");
  assert.equal(matchRule(msg, [a, b, c])?.rule.id, "c");
  // 우선순위·키워드 수가 같으면 먼저 등록한 것
  const a2 = rule({ id: "a2", keywords: ["짐 맡"], priority: 0 });
  assert.equal(matchRule(msg, [a, a2])?.rule.id, "a");
});

test("비활성 규칙과 빈 키워드는 무시, 못 찾으면 null", () => {
  const off = rule({ id: "off", keywords: ["주차"], enabled: false });
  const empty = rule({ id: "empty", keywords: ["", "  "] });
  assert.equal(matchRule("주차 되나요", [off, empty]), null);
});

test("한글 1글자 키워드는 앞뒤가 한글이 아닐 때만 걸린다 (아침 → 짐 오탐 방지)", () => {
  assert.equal(keywordMatches("아침에 체크인 되나요", "짐"), false);
  assert.equal(keywordMatches("체크인 전에 짐 맡길 수 있나요", "짐"), true);
  assert.equal(keywordMatches("짐을 맡길 수 있나요", "짐"), false);
  const luggage = rule({ id: "luggage", keywords: ["짐"] });
  const checkin = rule({ id: "checkin", keywords: ["체크인"] });
  assert.equal(matchRule("아침에 체크인 되나요", [luggage, checkin])?.rule.id, "checkin");
  assert.equal(matchRule("아침 식사 되나요", [luggage]), null);
});

test("라틴 키워드는 단어 경계로 맞춘다 (checking → check in 오탐 방지)", () => {
  assert.equal(keywordMatches("I'm just checking the price", "check in"), false);
  assert.equal(keywordMatches("Can I check in early?", "check in"), true);
  assert.equal(keywordMatches("Can I check-in early?", "check in"), true);
  assert.equal(keywordMatches("Early checkin possible?", "check in"), true);
  assert.equal(keywordMatches("checkin?", "check-in"), true);
  assert.equal(keywordMatches("What's the wifi password", "wi-fi"), true);
  assert.equal(keywordMatches("What's the wi-fi password", "wifi"), true);
  assert.equal(keywordMatches("Is there a bed for kids", "bed"), true);
  assert.equal(keywordMatches("wifi비밀번호", "wifi"), true);
  assert.equal(keywordMatches("the bedroom is small", "bed"), false);
  assert.equal(keywordMatches("vanilla ice cream", "van"), false);
  assert.equal(keywordMatches("a van is fine", "van"), true);
  assert.equal(keywordMatches("the room 6011", "6011"), true);
  assert.equal(keywordMatches("room 60110", "6011"), false);
  const checkin = rule({ id: "checkin", keywords: ["check in"] });
  assert.equal(matchRule(TRANSLATED("가격을 확인 중이에요", "I'm checking the price"), [checkin]), null);
  assert.equal(matchRule(TRANSLATED("체크인 중이에요", "We are checking in now"), [checkin])?.rule.id, "checkin");
});

test("라틴 키워드는 활용형·복수형에도 걸린다 (운영 DB 키워드 회귀 방지)", () => {
  assert.equal(keywordMatches("How many beds are there?", "bed"), true);
  assert.equal(keywordMatches("bedroom has two beds", "bed"), true);
  assert.equal(keywordMatches("What is your cancellation policy", "cancel"), true);
  assert.equal(keywordMatches("I cancelled my booking", "cancel"), true);
  assert.equal(keywordMatches("We are arriving at 5pm", "arrive"), true);
  assert.equal(keywordMatches("our arrival is at 5pm", "arrive"), true);
  assert.equal(keywordMatches("Is it walking distance", "walk"), true);
  assert.equal(keywordMatches("Can we bring dogs", "dog"), true);
  assert.equal(keywordMatches("any discounts?", "discount"), true);
  assert.equal(keywordMatches("checked in already", "check in"), true);
  assert.equal(keywordMatches("checking in tomorrow", "check in"), true);
  assert.equal(keywordMatches("late checkout possible?", "checkout"), true);
  assert.equal(keywordMatches("late checkout possible?", "check out"), true);
  assert.equal(keywordMatches("the prices are high", "price"), true);
  assert.equal(keywordMatches("is parking available", "park the"), false);
  assert.equal(keywordMatches("can I park the car", "park the"), true);
  // 접미사는 활용형까지만: 전혀 다른 단어에는 안 걸린다
  assert.equal(keywordMatches("I'm just checking the price", "check in"), false);
  assert.equal(keywordMatches("checking", "check in"), false);
});

test("라틴 키워드 글자 사이 구분자는 단어 안 1개, 단어 사이 3개까지만 본다", () => {
  assert.equal(keywordMatches("check - in", "check in"), true);
  assert.equal(keywordMatches("c\nh\ne\nc\nk in", "check in"), false);
  assert.equal(keywordMatches("w i f i", "wifi"), true);
  assert.equal(keywordMatches("w  i  f  i", "wifi"), false);
  assert.equal(keywordMatches("check\n\n\n\nin", "check in"), false);
  assert.equal(keywordMatches("체크 check 인 in", "check in"), false);
});

test("번역 라벨 줄은 매칭 대상에서 뺀다 (메시지 → 라벨 오탐 방지)", () => {
  assert.equal(stripTranslationLabel("안녕\n\n원문에서 자동 번역된 메시지:\n\nHi").includes("메시지"), false);
  const msg = rule({ id: "msg", keywords: ["메시지", "message"] });
  const subway = rule({ id: "subway", keywords: ["지하철"] });
  assert.equal(matchRule(TRANSLATED("여기서 가까운 지하철역은?", "Which subway station is close?"), [msg, subway])?.rule.id, "subway");
  assert.equal(matchRule(TRANSLATED("안녕하세요", "Hello"), [msg]), null);
  assert.equal(matchRule(TRANSLATED("메시지 받으셨나요", "Did you get my message"), [msg])?.rule.id, "msg");
});

test("renderAnswer 는 변수를 채우고 없는 값은 빈 문자열", () => {
  const out = renderAnswer("{게스트이름}님 안녕하세요! 와이파이는 {와이파이이름} / {와이파이비밀번호} 입니다. {주소}", {
    guestName: "하나",
    wifiSsid: "popostay",
    wifiPassword: "1234",
  });
  assert.equal(out, "하나님 안녕하세요! 와이파이는 popostay / 1234 입니다.");
});

test("detectLanguage: 번역 블록 아래 원문 기준으로 ko/en/zh/ja 를 가린다", () => {
  assert.equal(detectLanguage("체크인 몇 시에요?"), "ko");
  assert.equal(detectLanguage("wifi 비밀번호 알려주세요"), "ko");
  assert.equal(detectLanguage("Which subway station is close?"), "en");
  assert.equal(detectLanguage("请问最近的地铁站离这大概要多久"), "zh");
  assert.equal(detectLanguage("一番近い駅はどこですか"), "ja");
  assert.equal(detectLanguage("チェックインは何時ですか"), "ja");
  assert.equal(detectLanguage(TRANSLATED("여기서 가장 가까운 지하철역까지 얼마나 걸리나요?", "请问最近的地铁站离这大概要多久")), "zh");
  assert.equal(detectLanguage(TRANSLATED("여기서 가까운 지하철역은?", "Which subway station is close?")), "en");
  assert.equal(detectLanguage(TRANSLATED("체크인은 몇 시인가요?", "チェックインは何時ですか")), "ja");
  assert.equal(detectLanguage("👍"), "ko");
  assert.equal(detectLanguage(""), "ko");
  assert.equal(detectLanguage("Hi, 체크인 가능할까요?"), "ko");
  assert.equal(detectLanguage("Hello, WiFi password please? 감사"), "en");
});

test("pickAnswer: 원문 언어별 답변 → 영어 → 한국어 순", () => {
  const full = rule({ answer: "한국어 답", answer_en: "English answer", answer_zh: "中文回答", answer_ja: "日本語の返事" });
  assert.equal(pickAnswer(full, TRANSLATED("여기서 가까운 지하철역은?", "Which subway station is close?")), "English answer");
  assert.equal(pickAnswer(full, TRANSLATED("가까운 역", "请问最近的地铁站")), "中文回答");
  assert.equal(pickAnswer(full, TRANSLATED("가까운 역", "一番近い駅はどこですか")), "日本語の返事");
  assert.equal(pickAnswer(full, "체크인 몇 시에요?"), "한국어 답");

  const enOnly = rule({ answer: "한", answer_en: "English" });
  assert.equal(pickAnswer(enOnly, "请问最近的地铁站"), "English");
  assert.equal(pickAnswer(enOnly, "一番近い駅"), "English");
  assert.deepEqual(pickAnswerWithLang(enOnly, "请问最近的地铁站"), { text: "English", detected: "zh", answerLang: "en" });

  const koOnly = rule({ answer: "한", answer_en: "", answer_zh: "  " });
  assert.equal(pickAnswer(koOnly, "hello there"), "한");
  assert.equal(pickAnswer(koOnly, "请问最近的地铁站"), "한");
  assert.deepEqual(pickAnswerForLang(koOnly, "ja"), { text: "한", answerLang: "ko" });
  assert.equal(isKoreanOriginal("请问最近的地铁站"), false);
  assert.equal(isKoreanOriginal("체크인 몇 시에요?"), true);
});

test("protectVariables/restoreVariables: 변수 토큰을 자리표시로 바꿨다 되돌린다", () => {
  const { text, tokens } = protectVariables("{게스트이름}님, 와이파이는 {와이파이이름} / {와이파이비밀번호} 입니다.");
  assert.equal(text, "⟦1⟧님, 와이파이는 ⟦2⟧ / ⟦3⟧ 입니다.");
  assert.deepEqual(tokens, ["{게스트이름}", "{와이파이이름}", "{와이파이비밀번호}"]);
  assert.equal(restoreVariables("Hi ⟦1⟧, Wi-Fi: ⟦2⟧ / ⟦ 3 ⟧.", tokens), "Hi {게스트이름}, Wi-Fi: {와이파이이름} / {와이파이비밀번호}.");
  // 자리표시가 사라지거나 깨지면 null
  assert.equal(restoreVariables("Hi ⟦1⟧, Wi-Fi: ⟦2⟧.", tokens), null);
  assert.equal(restoreVariables("Hi ⟦1⟧, ⟦2⟧ / ⟦9⟧.", tokens), null);
  assert.equal(restoreVariables("Hi ⟦1⟧, ⟦2⟧ / ⟦3", tokens), null);
  // 한 자리표시가 중복되고 다른 하나가 빠지면(개수는 같아도) null
  assert.equal(restoreVariables("⟦1⟧ ⟦1⟧ ⟦3⟧", tokens), null);
  assert.equal(restoreVariables("⟦1⟧ ⟦1⟧", ["{게스트이름}", "{주소}"]), null);
  assert.equal(restoreVariables("no variables", []), "no variables");
});

test("suggestKeywords 는 불용어를 빼고 앞에서부터 최대 6개", () => {
  assert.deepEqual(suggestKeywords("안녕하세요 혹시 체크인 전에 짐 보관 되나요?"), ["체크인", "전에", "보관"]);
});

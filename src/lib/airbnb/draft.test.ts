import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, formatContext, buildInstructions, draftModelId, DEFAULT_DRAFT_MODEL } from "./draft.ts";

const ctx = {
  name: "포포스테이 서촌 한옥",
  description: null,
  address: "서울 종로구",
  wifi_ssid: "popostay",
  wifi_password: "1234",
  checkin_guide: "체크인은 오후 3시부터입니다.",
  checkout_guide: null,
  house_rules: "실내 금연",
  guides: [{ title: "보일러 사용법", category: "appliance", content: "온도 조절은 거실 패널에서" }],
  faqs: [{ question: "짐 보관 되나요?", answer: "체크인 전 짐 보관은 현관 앞 박스에 가능합니다." }],
};

test("formatContext 는 비어있지 않은 항목만 넣는다", () => {
  const out = formatContext(ctx);
  assert.match(out, /숙소 이름: 포포스테이 서촌 한옥/);
  assert.match(out, /와이파이: popostay \/ 비밀번호 1234/);
  assert.match(out, /\[appliance\] 보일러 사용법: 온도 조절은 거실 패널에서/);
  assert.match(out, /Q: 짐 보관 되나요\?/);
  assert.doesNotMatch(out, /체크아웃 안내/);
  assert.doesNotMatch(out, /소개:/);
});

test("formatContext(null) 은 정보 없음 안내를 준다", () => {
  assert.match(formatContext(null), /숙소 정보 없음/);
});

test("buildPrompt 는 게스트 메시지와 예약 기간을 담는다", () => {
  const prompt = buildPrompt(
    {
      id: "x",
      guest_name: "홍길동",
      listing_name: null,
      message_text: "짐을 먼저 맡길 수 있을까요?",
      snippet: null,
      check_in: "2026-10-21",
      check_out: "2026-10-23",
      property_id: null,
    },
    ctx
  );
  assert.match(prompt, /이름: 홍길동/);
  assert.match(prompt, /예약 기간: 2026-10-21 ~ 2026-10-23/);
  assert.match(prompt, /짐을 먼저 맡길 수 있을까요\?/);
});

test("본문이 없으면 snippet, 그것도 없으면 안내 문구를 쓴다", () => {
  const base = { id: "x", guest_name: null, listing_name: null, check_in: null, check_out: null, property_id: null };
  assert.match(buildPrompt({ ...base, message_text: null, snippet: "요약만 있음" }, null), /요약만 있음/);
  assert.match(buildPrompt({ ...base, message_text: null, snippet: null }, null), /메시지 본문이 메일에 포함되지 않음/);
});

test("instructions 는 언어 일치와 사실 제한 규칙을 포함한다", () => {
  const ins = buildInstructions();
  assert.match(ins, /같은 언어/);
  assert.match(ins, /지어내지/);
});

test("모델 ID 는 env 로 바꿀 수 있다", () => {
  const prev = process.env.AIRBNB_DRAFT_MODEL;
  delete process.env.AIRBNB_DRAFT_MODEL;
  assert.equal(draftModelId(), DEFAULT_DRAFT_MODEL);
  process.env.AIRBNB_DRAFT_MODEL = "anthropic/claude-sonnet-5.5";
  assert.equal(draftModelId(), "anthropic/claude-sonnet-5.5");
  if (prev === undefined) delete process.env.AIRBNB_DRAFT_MODEL;
  else process.env.AIRBNB_DRAFT_MODEL = prev;
});

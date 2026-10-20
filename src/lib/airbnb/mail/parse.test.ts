import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseRawMail } from "./imap.ts";
import { parseAirbnbMail } from "./parse.ts";

const fixturesDir = path.join(import.meta.dirname, "__fixtures__");

async function parseFixture(name: string) {
  const raw = await readFile(path.join(fixturesDir, name));
  const mail = await parseRawMail(raw);
  return { mail, parsed: parseAirbnbMail(mail) };
}

test("한국어 메시지 알림: 이름, 숙소, 본문, 스레드, 날짜, 예약코드", async () => {
  const { mail, parsed } = await parseFixture("message-ko.eml");
  assert.equal(mail.messageId, "<msg-ko-0001@airbnb.com>");
  assert.equal(parsed.isAirbnb, true);
  assert.equal(parsed.kind, "message");
  assert.equal(parsed.guestName, "홍길동");
  assert.equal(parsed.listingName, "포포스테이 서촌 한옥");
  assert.equal(parsed.threadId, "1234567890");
  assert.match(parsed.threadUrl ?? "", /messaging\/thread\/1234567890/);
  assert.equal(parsed.reservationCode, "HMABCD1234");
  assert.equal(parsed.checkIn, "2026-10-21");
  assert.equal(parsed.checkOut, "2026-10-23");
  assert.equal(
    parsed.messageText,
    "안녕하세요! 내일 체크인인데 짐을 먼저 맡길 수 있을까요?\n오후 1시쯤 도착할 것 같아요."
  );
});

test("영어 메시지 알림(HTML만, 추적 링크): 인코딩된 스레드 ID 복원", async () => {
  const { parsed } = await parseFixture("message-en-tracked.eml");
  assert.equal(parsed.isAirbnb, true);
  assert.equal(parsed.kind, "message");
  assert.equal(parsed.guestName, "Alex Kim");
  assert.equal(parsed.threadId, "9876543210");
  assert.equal(parsed.listingName, "Popo Stay Seochon Hanok");
  assert.equal(parsed.checkIn, "2026-10-24");
  assert.equal(parsed.checkOut, "2026-10-26");
  assert.match(parsed.messageText ?? "", /early check-in possible/);
});

test("한국어 예약 요청: 종류, 이름, 예약코드, 날짜", async () => {
  const { parsed } = await parseFixture("reservation-request-ko.eml");
  assert.equal(parsed.kind, "reservation_request");
  assert.equal(parsed.guestName, "Kenji");
  assert.equal(parsed.reservationCode, "HMZZ99887766");
  assert.equal(parsed.checkIn, "2026-11-02");
  assert.equal(parsed.checkOut, "2026-11-05");
  assert.equal(parsed.messageText, null);
});

test("에어비앤비가 아닌 메일은 isAirbnb=false", async () => {
  const { parsed } = await parseFixture("not-airbnb.eml");
  assert.equal(parsed.isAirbnb, false);
});

test("본문이 없는 알림(제목만)은 kind 와 스레드만 채운다", () => {
  const parsed = parseAirbnbMail({
    subject: "New message from Mina",
    from: "Airbnb <automated@airbnb.com>",
    html: '<a href="https://www.airbnb.com/hosting/inbox/thread/5555555555">View message</a>',
  });
  assert.equal(parsed.kind, "message");
  assert.equal(parsed.guestName, "Mina");
  assert.equal(parsed.threadId, "5555555555");
  assert.equal(parsed.messageText, null);
});

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

// ---------------------------------------------------------------------------
// 실제 에어비앤비 메일 구조(2026-10, 한국어 계정)를 본뜬 픽스처
// ---------------------------------------------------------------------------

test("실제 숙박 문의: 이름, 해시태그 숙소명, 리스팅 번호, 스레드, 본문, 날짜", async () => {
  const { parsed } = await parseFixture("inquiry-ko-real.eml");
  assert.equal(parsed.kind, "message");
  assert.equal(parsed.guestName, "하나");
  assert.equal(parsed.listingName, "#홍대입구역 #최대6인 #짐보관서비스 #연희•연남동 #공항철도 #인천공항 1시간 #홈씨어터");
  assert.equal(parsed.listingId, "1679457331224179554");
  assert.equal(parsed.threadId, "2695603474");
  assert.equal(parsed.messageText, "이 숙소 정말 마음에 듭니다. 혹시 체크인 전에 짐을 맡길 수 있을까요?\n오후 1시쯤 도착할 것 같아요.");
  assert.equal(parsed.checkIn, "2027-01-01");
  assert.equal(parsed.checkOut, "2027-01-03");
  assert.doesNotMatch(parsed.snippet, /opentrack|https?:/);
});

test("실제 예약 확정: 이름(제목), 예약코드, 스레드, 날짜", async () => {
  const { parsed } = await parseFixture("reservation-confirmed-ko-real.eml");
  assert.equal(parsed.kind, "reservation_confirmed");
  assert.equal(parsed.guestName, "Wai Peng");
  assert.equal(parsed.reservationCode, "HMS3QZHCEQ");
  assert.equal(parsed.threadId, "2694546297");
  assert.equal(parsed.checkIn, "2027-01-25");
  assert.equal(parsed.checkOut, "2027-02-02");
  assert.equal(parsed.messageText, null);
});

test("실제 예약 요청: 이름(본문), 예약코드, 제목의 기간으로 날짜, 스레드 없음", async () => {
  const { parsed } = await parseFixture("reservation-request-ko-real.eml");
  assert.equal(parsed.kind, "reservation_request");
  assert.equal(parsed.guestName, "螢");
  assert.equal(parsed.reservationCode, "HMZZMA4MS5");
  assert.equal(parsed.checkIn, "2026-12-23");
  assert.equal(parsed.checkOut, "2026-12-27");
  assert.equal(parsed.threadId, null);
  assert.equal(parsed.listingId, "1679457331224179554");
});

test("실제 취소: 이름, 예약코드, 리스팅 번호", async () => {
  const { parsed } = await parseFixture("cancelled-ko-real.eml");
  assert.equal(parsed.kind, "reservation_cancelled");
  assert.equal(parsed.guestName, "Yoyo");
  assert.equal(parsed.reservationCode, "HM3SEZ3J95");
  assert.equal(parsed.listingId, "1679457331224179554");
  assert.match(parsed.listingName ?? "", /^#홍대입구역/);
});

test("연말을 넘기는 기간 '2026년 12월 30일~1월 2일' 은 다음 해로 계산", () => {
  const parsed = parseAirbnbMail({
    subject: "대기 중: 2026년 12월 30일~1월 2일 #숙소 예약 요청",
    from: "Airbnb <automated@airbnb.com>",
    text: "누군가님의 예약 요청에 답하세요.",
  });
  assert.equal(parsed.checkIn, "2026-12-30");
  assert.equal(parsed.checkOut, "2027-01-02");
});

test("실제 숙박 문의(가입 연도 없이 '본인 인증 완료 / 도시' 프로필): 프로필 줄은 본문에서 제외", async () => {
  const { parsed } = await parseFixture("inquiry-ko-real-profile.eml");
  assert.equal(parsed.kind, "message");
  assert.equal(parsed.guestName, "두리");
  assert.equal(parsed.messageText, "안녕하세요. 욕실이 방 안에 있는지 여쭤봐도 될까요?");
});

test("실제 게스트 메시지(express@, 'RE: #숙소 예약(5월 11일~12일)'): 종류, 이름, 본문, 날짜", async () => {
  const { parsed } = await parseFixture("guest-message-ko-real.eml");
  assert.equal(parsed.kind, "message");
  assert.equal(parsed.guestName, "유나");
  assert.equal(parsed.messageText, "감사합니다 즐거운 여행 보낼게요!");
  assert.match(parsed.listingName ?? "", /^#홍대입구역/);
  assert.equal(parsed.checkIn, "2026-05-11");
  assert.equal(parsed.checkOut, "2026-05-12");
});

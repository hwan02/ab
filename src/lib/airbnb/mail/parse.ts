/**
 * Airbnb 알림 메일 파서.
 *
 * 에어비앤비가 호스트/공동호스트에게 보내는 알림 메일(새 메시지, 예약 요청, 예약 확정 등)을
 * 구조화된 데이터로 바꾼다. 메일 포맷은 에어비앤비가 예고 없이 바꾸므로 모든 추출은
 * "있으면 채우고 없으면 null" 원칙으로 동작하고, 최소한 스레드 링크와 종류만 알아내는 것을 목표로 한다.
 *
 * 입력은 이미 MIME 디코딩이 끝난 상태(제목, 보낸이, 텍스트 본문, HTML 본문)를 받는다.
 * 실제 메일 수신(IMAP)은 imap.ts, 저장/알림은 route 쪽 책임이다.
 */

export type AirbnbMailKind =
  | "message" // 게스트가 메시지를 보냄
  | "reservation_request" // 예약 요청 (수락/거절 필요)
  | "reservation_confirmed" // 예약 확정
  | "reservation_cancelled" // 예약 취소
  | "review" // 후기 관련
  | "other"; // 에어비앤비 메일이지만 분류 불가

export interface ParsedAirbnbMail {
  /** 에어비앤비가 보낸 메일인지. false면 나머지 필드는 신뢰하지 않는다. */
  isAirbnb: boolean;
  kind: AirbnbMailKind;
  /** 상대방(게스트) 표시 이름. 제목/본문에서 추출. */
  guestName: string | null;
  /** 숙소 이름. 본문에서 추출. */
  listingName: string | null;
  /** 메시지 스레드로 바로 가는 링크 (추적 링크일 수 있음). */
  threadUrl: string | null;
  /** 스레드 ID. URL에 노출돼 있을 때만. */
  threadId: string | null;
  /** 예약 코드 (예: HMABC12345). */
  reservationCode: string | null;
  /** 게스트 메시지 본문. 알림 메일에 본문이 포함되지 않으면 null. */
  messageText: string | null;
  /** 체크인/체크아웃. 본문에 날짜가 있을 때만 (YYYY-MM-DD 또는 원문). */
  checkIn: string | null;
  checkOut: string | null;
  /** 메일 원문 요약(디버깅/표시용). HTML 태그 제거 후 앞부분. */
  snippet: string;
}

export interface RawMailInput {
  subject?: string | null;
  from?: string | null; // "Airbnb <automated@airbnb.com>" 형태
  text?: string | null;
  html?: string | null;
}

const AIRBNB_SENDER_RE = /@(?:[a-z0-9-]+\.)*airbnb\.(?:com|co\.kr|net)\b/i;

/** 에어비앤비 메시지/예약 관련 링크 패턴. */
const THREAD_URL_RE =
  /https?:\/\/(?:[a-z0-9-]+\.)*airbnb\.[a-z.]+\/(?:messaging\/(?:thread\/|qt\/)?|hosting\/(?:inbox|messages|thread)\/?|z\/)[^\s"'<>)\]]*/gi;

const THREAD_ID_RE = /(?:thread|qt)\/(\d{6,})/i;
const RESERVATION_CODE_RE = /\b(HM[A-Z0-9]{8,10})\b/;

/** 추적 링크 안에 원본 URL이 인코딩돼 있는 경우(airbnb.com/z/… 또는 click 링크) 그것도 뒤져본다. */
const ENCODED_THREAD_RE = /messaging(?:%2F|\/)thread(?:%2F|\/)(\d{6,})/i;

export function parseAirbnbMail(input: RawMailInput): ParsedAirbnbMail {
  const subject = (input.subject ?? "").trim();
  const from = input.from ?? "";
  const html = input.html ?? "";
  const text = (input.text && input.text.trim().length > 0 ? input.text : htmlToText(html)).trim();

  const isAirbnb = AIRBNB_SENDER_RE.test(from) || /airbnb/i.test(subject) || /airbnb\.com/i.test(html);

  const kind = classify(subject, text);
  const guestName = extractGuestName(subject, text);
  const listingName = extractListingName(text);
  const { threadUrl, threadId } = extractThread(html, text);
  const reservationCode = RESERVATION_CODE_RE.exec(subject + "\n" + text)?.[1] ?? null;
  const messageText = kind === "message" ? extractMessageBody(text, guestName) : null;
  const { checkIn, checkOut } = extractDates(text);

  return {
    isAirbnb,
    kind,
    guestName,
    listingName,
    threadUrl,
    threadId,
    reservationCode,
    messageText,
    checkIn,
    checkOut,
    snippet: text.replace(/\s+/g, " ").slice(0, 300),
  };
}

// ---------------------------------------------------------------------------
// 분류
// ---------------------------------------------------------------------------

function classify(subject: string, text: string): AirbnbMailKind {
  const s = subject.toLowerCase();
  const head = text.slice(0, 600).toLowerCase();

  if (/취소|cancel/.test(s)) return "reservation_cancelled";
  if (/후기|리뷰|review/.test(s)) return "review";
  if (/예약 요청|reservation request|booking request|요청을 보냈|requested to book|wants to book/.test(s)) {
    return "reservation_request";
  }
  if (/예약(이|가)? ?확정|confirmed|예약 완료|new booking|new reservation|booked/.test(s)) {
    return "reservation_confirmed";
  }
  if (
    /메시지|message|문의|inquiry|sent you|보냈습니다|답장|reply/.test(s) ||
    /새 메시지|new message|메시지를 보냈/.test(head)
  ) {
    return "message";
  }
  return "other";
}

// ---------------------------------------------------------------------------
// 게스트 이름
// ---------------------------------------------------------------------------

const NAME = "([A-Za-z][A-Za-z .'-]{0,40}|[가-힣]{2,10}|[ぁ-んァ-ン一-龥]{1,10})";

const GUEST_NAME_PATTERNS: RegExp[] = [
  // 한국어 제목: "홍길동님이 메시지를 보냈습니다", "Alex 님의 새 메시지"
  new RegExp(`^${NAME}\\s*님(?:이|의|께서)?\\s*(?:새\\s*)?(?:메시지|문의|예약|요청)`),
  new RegExp(`${NAME}\\s*님(?:이|께서)\\s*(?:메시지를\\s*보냈|문의)`),
  // 영어 제목: "New message from Alex", "Alex sent you a message", "Reservation request from Alex"
  new RegExp(`(?:message|request|inquiry|reservation)\\s+from\\s+${NAME}(?:\\s*[:\\-–—]|\\s*$)`, "i"),
  new RegExp(`^${NAME}\\s+(?:sent you|has sent|wants to book|requested)`, "i"),
  // 본문: "홍길동님의 메시지:", "Message from Alex:"
  new RegExp(`${NAME}\\s*님(?:의|이)\\s*(?:메시지|문의)`),
];

function extractGuestName(subject: string, text: string): string | null {
  for (const re of GUEST_NAME_PATTERNS) {
    const m = re.exec(subject);
    if (m?.[1]) return cleanName(m[1]);
  }
  for (const re of GUEST_NAME_PATTERNS) {
    const m = re.exec(text.slice(0, 800));
    if (m?.[1]) return cleanName(m[1]);
  }
  return null;
}

function cleanName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) return null;
  // "New", "Airbnb" 같은 오탐 제거
  if (/^(new|airbnb|your|a|the|host|guest|새|에어비앤비)$/i.test(name)) return null;
  return name;
}

// ---------------------------------------------------------------------------
// 숙소 이름
// ---------------------------------------------------------------------------

function extractListingName(text: string): string | null {
  const patterns = [
    /숙소[:：]\s*(.+)/,
    /(?:^|\n)\s*(?:숙소 이름|Listing|Property)[:：]\s*(.+)/i,
    /(?:at|in|for)\s+[“"]([^”"]{3,80})[”"]/i,
    /[“"]([^”"]{3,80})[”"]\s*(?:숙소|에 대한|관련)/,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m?.[1]) {
      const name = m[1]
        .trim()
        .replace(/[.。]$/, "")
        .replace(/^[“"'‘]+|[”"'’]+$/g, "")
        .trim();
      if (name) return name;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 스레드 링크
// ---------------------------------------------------------------------------

function extractThread(html: string, text: string): { threadUrl: string | null; threadId: string | null } {
  const sources = [html, text];
  let firstUrl: string | null = null;

  for (const src of sources) {
    const matches = src.match(THREAD_URL_RE) ?? [];
    for (const raw of matches) {
      const url = decodeHtmlEntities(raw);
      if (!firstUrl) firstUrl = url;
      const id = THREAD_ID_RE.exec(url)?.[1] ?? ENCODED_THREAD_RE.exec(url)?.[1] ?? null;
      if (id) return { threadUrl: url, threadId: id };
    }
  }

  // 링크는 없지만 인코딩된 스레드 ID가 어딘가에 있을 때
  const encoded = ENCODED_THREAD_RE.exec(html) ?? ENCODED_THREAD_RE.exec(text);
  return { threadUrl: firstUrl, threadId: encoded?.[1] ?? null };
}

// ---------------------------------------------------------------------------
// 메시지 본문
// ---------------------------------------------------------------------------

/**
 * 알림 메일에서 게스트가 쓴 문장만 떼어낸다.
 * 에어비앤비는 보통 인용 블록이나 "메시지:" 뒤에 본문을 넣고, 그 아래에 "답장하기" 버튼과 푸터가 온다.
 */
function extractMessageBody(text: string, guestName: string | null): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[>\s]+/, "").trim());

  const startMarkers = [
    /^(?:메시지|새 메시지|문의 내용|Message)[:：]?$/i,
    guestName ? new RegExp(`^${escapeRe(guestName)}\\s*(?:님(?:의|이)?|:|wrote|says)`, "i") : null,
    /(?:보냈습니다|sent you a message|wrote)[:：]?$/i,
  ].filter(Boolean) as RegExp[];

  const endMarkers = [
    /^(?:답장|답장하기|메시지 보기|Reply|View message|View in app|앱에서 보기|대화 보기)/i,
    /^https?:\/\//i,
    /^(?:감사합니다|Thanks|Thank you),?\s*$/i,
    /^(?:에어비앤비|Airbnb)(?:\s|,|$)/i,
    /^(?:본 메일은|이 이메일은|This email was sent|You are receiving)/i,
  ];

  // 마커 우선순위대로 찾는다. "메시지:" 같은 명시적 마커가 "…보냈습니다" 헤더보다 우선.
  let start = -1;
  for (const re of startMarkers) {
    const idx = lines.findIndex((l) => re.test(l));
    if (idx !== -1) {
      start = idx + 1;
      break;
    }
  }

  // 시작 마커를 못 찾으면 첫 비어있지 않은 긴 문단을 본문으로 간주
  if (start === -1) {
    const idx = lines.findIndex((l) => l.length >= 10 && !/^(?:https?:|안녕하세요|hi\b|hello\b)/i.test(l));
    if (idx === -1) return null;
    start = idx;
  }

  const body: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (endMarkers.some((re) => re.test(line))) break;
    if (line === "" && body.length > 0 && body[body.length - 1] === "") continue;
    body.push(line);
  }

  const joined = body.join("\n").trim();
  return joined.length > 0 ? joined.slice(0, 4000) : null;
}

// ---------------------------------------------------------------------------
// 날짜
// ---------------------------------------------------------------------------

function extractDates(text: string): { checkIn: string | null; checkOut: string | null } {
  // "체크인: 2026년 10월 24일", "Check-in: Oct 24, 2026", "10월 24일 ~ 10월 26일"
  const ko = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g;
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  const en = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi;

  const found: string[] = [];
  for (const m of text.matchAll(ko)) found.push(`${m[1]}-${pad(m[2])}-${pad(m[3])}`);
  for (const m of text.matchAll(iso)) found.push(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of text.matchAll(en)) {
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
      m[1].slice(0, 3).toLowerCase()
    );
    if (month >= 0) found.push(`${m[3]}-${pad(String(month + 1))}-${pad(m[2])}`);
  }

  const unique = [...new Set(found)].sort();
  return { checkIn: unique[0] ?? null, checkOut: unique[1] ?? null };
}

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------

export function htmlToText(html: string): string {
  if (!html) return "";
  return decodeHtmlEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<head[\s\S]*?<\/head>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|tr|li|h[1-6]|blockquote|table)>/gi, "\n")
      .replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, inner) => {
        const label = inner.replace(/<[^>]+>/g, "").trim();
        return label ? `${label} ${href}` : href;
      })
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n");
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)));
}

function pad(n: string): string {
  return n.padStart(2, "0");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

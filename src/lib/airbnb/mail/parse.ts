/**
 * Airbnb 알림 메일 파서.
 *
 * 에어비앤비가 호스트/공동호스트에게 보내는 알림 메일(새 메시지, 숙박 문의, 예약 요청, 예약 확정, 취소, 후기)을
 * 구조화된 데이터로 바꾼다. 메일 포맷은 에어비앤비가 예고 없이 바꾸므로 모든 추출은
 * "있으면 채우고 없으면 null" 원칙으로 동작하고, 최소한 스레드 링크와 종류만 알아내는 것을 목표로 한다.
 *
 * 실제 메일(2026-10 기준, 한국어 계정)에서 확인한 구조:
 *   - text 본문 맨 위에 "%opentrack%" 추적 문자열과 추적 URL 이 온다.
 *   - 링크는 "[https://...]" 처럼 대괄호로 감싸서 별도 줄에 온다.
 *   - 숙소 이름은 "#홍대입구역 #최대6인 ..." 처럼 해시태그 제목 한 줄로 온다.
 *   - 숙박 문의: "X 님의 예약 문의에 응답하세요" → 이름 → [스레드 링크] → "에어비앤비 가입 연도: N" → 게스트 메시지 → "예약 사전 승인 또는 거절"
 *   - 예약 확정: "새로운 예약이 확정되었습니다! X 님이 M월 D일에 체크인할 예정입니다", 예약 코드 HM..., 스레드 링크
 *   - 예약 요청: "X님의 예약 요청에 답하세요.", 수락/거절 링크(스레드 없음), 제목에 "YYYY년 M월 D일~D일"
 *   - 취소: "게스트 X 님이 M월 D일~D일 예약(HM...)을 취소했습니다."
 *
 * 입력은 이미 MIME 디코딩이 끝난 상태(제목, 보낸이, 텍스트 본문, HTML 본문)를 받는다.
 */

export type AirbnbMailKind =
  | "message" // 게스트가 메시지/숙박 문의를 보냄
  | "reservation_request" // 예약 요청 (수락/거절 필요)
  | "reservation_confirmed" // 예약 확정
  | "reservation_cancelled" // 예약 취소
  | "review" // 후기 관련
  | "other"; // 에어비앤비 메일이지만 분류 불가 (계정 활동, 대금 지급, 커뮤니티 등)

export interface ParsedAirbnbMail {
  /** 에어비앤비가 보낸 메일인지. false면 나머지 필드는 신뢰하지 않는다. */
  isAirbnb: boolean;
  kind: AirbnbMailKind;
  /** 상대방(게스트) 표시 이름. */
  guestName: string | null;
  /** 숙소 이름. 해시태그 제목 한 줄. */
  listingName: string | null;
  /** 에어비앤비 리스팅 번호. rooms/{id} 링크나 "리스팅 번호 #id" 에서. */
  listingId: string | null;
  /** 메시지 스레드로 바로 가는 링크 (추적 파라미터 포함). */
  threadUrl: string | null;
  /** 스레드 ID. */
  threadId: string | null;
  /** 예약 코드 (예: HMABC12345). */
  reservationCode: string | null;
  /** 게스트 메시지 본문. 알림 메일에 본문이 포함되지 않으면 null. */
  messageText: string | null;
  /** 체크인/체크아웃 (YYYY-MM-DD). */
  checkIn: string | null;
  checkOut: string | null;
  /** 메일 원문 요약(디버깅/표시용). 추적 문자열과 링크를 뺀 앞부분. */
  snippet: string;
}

export interface RawMailInput {
  subject?: string | null;
  from?: string | null; // "Airbnb <automated@airbnb.com>" 형태
  text?: string | null;
  html?: string | null;
}

const AIRBNB_SENDER_RE = /@(?:[a-z0-9-]+\.)*airbnb\.(?:com|co\.kr|net)\b/i;

/** 에어비앤비 메시지 스레드 링크. hosting/thread/{id}, messaging/thread/{id}, hosting/inbox/thread/{id} 등. */
const THREAD_URL_RE =
  /https?:\/\/(?:[a-z0-9-]+\.)*airbnb\.[a-z.]+\/(?:messaging\/(?:thread\/|qt\/)?|hosting\/(?:inbox\/)?(?:messages|thread)\/?|z\/)[^\s"'<>)\]]*/gi;

const THREAD_ID_RE = /(?:thread|qt)\/(\d{6,})/i;
const ENCODED_THREAD_RE = /(?:messaging|hosting)(?:%2F|\/)thread(?:%2F|\/)(\d{6,})/i;
const RESERVATION_CODE_RE = /\b(HM[A-Z0-9]{8,10})\b/;
const LISTING_ID_RE = /(?:\/rooms\/(\d{6,})|리스팅 번호\s*#?(\d{6,})|hosting\/listings\/(\d{6,}))/i;

export function parseAirbnbMail(input: RawMailInput): ParsedAirbnbMail {
  const subject = (input.subject ?? "").trim();
  const from = input.from ?? "";
  const html = input.html ?? "";
  const rawText = (input.text && input.text.trim().length > 0 ? input.text : htmlToText(html)).trim();
  const lines = cleanLines(rawText);
  const text = lines.join("\n");

  const isAirbnb = AIRBNB_SENDER_RE.test(from) || /airbnb/i.test(subject) || /airbnb\.com/i.test(html);

  const kind = classify(subject, text, from);
  const guestName = extractGuestName(subject, lines);
  const listingName = extractListingName(lines);
  const listingId = extractListingId(rawText + "\n" + html);
  const { threadUrl, threadId } = extractThread(rawText, html);
  const reservationCode = RESERVATION_CODE_RE.exec(subject + "\n" + rawText)?.[1] ?? null;
  const messageText = kind === "message" ? extractMessageBody(lines, guestName) : null;
  const { checkIn, checkOut } = extractDates(subject, text);

  return {
    isAirbnb,
    kind,
    guestName,
    listingName,
    listingId,
    threadUrl,
    threadId,
    reservationCode,
    messageText,
    checkIn,
    checkOut,
    snippet: lines.slice(0, 12).join(" ").replace(/\s+/g, " ").slice(0, 300),
  };
}

// ---------------------------------------------------------------------------
// 전처리: 추적 문자열, 링크 줄, 보이지 않는 패딩 줄 제거
// ---------------------------------------------------------------------------

const URL_LINE_RE = /^\[?\s*https?:\/\/[^\s\]]+\s*\]?$/i;

export function cleanLines(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw
      .replace(/%opentrack%/gi, "")
      .replace(/[​‌‍⁠͏­﻿]/g, "") // zero-width, CGJ, soft hyphen
      .replace(/\[\s*https?:\/\/[^\]]*\]/gi, "") // 인라인 [url]
      .replace(/https?:\/\/\S+/gi, "") // 줄 안의 맨 URL ("https://...   #해시태그 제목" 형태)
      .replace(/^[>\s]+/, "")
      .replace(/\s+$/, "")
      .replace(/[ \t ]{2,}/g, "  "); // 표 형태의 넓은 공백은 2칸으로
    if (URL_LINE_RE.test(line)) continue;
    // 줄 안에 URL 만 여러 개 있는 경우
    if (/^(?:\s*https?:\/\/\S+\s*)+$/i.test(line)) continue;
    line = line.trim();
    if (line === "") {
      if (out.length > 0 && out[out.length - 1] !== "") out.push("");
      continue;
    }
    out.push(line);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

// ---------------------------------------------------------------------------
// 분류
// ---------------------------------------------------------------------------

function classify(subject: string, text: string, from: string): AirbnbMailKind {
  const s = subject.toLowerCase();
  const head = text.slice(0, 600).toLowerCase();

  // 운영 알림(게스트가 쓴 메시지가 아님): 사전 승인 권유, 문의 결정 요청, 예약 메시지 전송 실패, 응답 기한 리마인더
  if (
    /결정을 내려|사전 승인하실 수도|전송되지 않았습니다|회신을 전송하지/.test(s) ||
    /응답률도 높이세요|까지 [^\n]{1,40}님에게 응답하여/.test(head)
  ) {
    return "other";
  }

  // 게스트 일반 메시지: express@airbnb.com 발신, 제목 "RE: #숙소제목 예약(5월 11일~12일)",
  // 본문에 "예약자" 역할 줄과 "답장 보내기" 버튼. 제목만으로는 구분이 안 되므로 먼저 본다.
  if (
    (/^re:/i.test(s) && /예약\s*\(/.test(s)) ||
    /답장 보내기|이 이메일에 직접 회신|reply to this email/i.test(text) ||
    (/express@airbnb/i.test(from) && /^(?:예약자|게스트|guest)$/m.test(text))
  ) {
    return "message";
  }

  if (/취소|cancel/.test(s)) return "reservation_cancelled";
  if (/후기|리뷰|review/.test(s)) return "review";
  if (/예약 요청|대기 중|reservation request|booking request|requested to book|wants to book/.test(s)) {
    return "reservation_request";
  }
  if (/예약(이|가)? ?확정|confirmed|예약 완료|new booking|new reservation|booked/.test(s)) {
    return "reservation_confirmed";
  }
  if (
    /메시지|message|문의|inquiry|sent you|보냈습니다|답장|reply/.test(s) ||
    /새 메시지|new message|메시지를 보냈|예약 문의에 응답/.test(head)
  ) {
    return "message";
  }
  return "other";
}

// ---------------------------------------------------------------------------
// 게스트 이름
// ---------------------------------------------------------------------------

/** 영문/한글/일본어/중국어/태국어 등 이름. 공백 포함 최대 40자. */
const NAME = "([^\\s\\d#:：,.!?\\[\\]()<>\"'][^\\n:：\\[\\]()<>\"']{0,39}?)";

const SUBJECT_NAME_PATTERNS: RegExp[] = [
  // "예약 확정 - Wai Peng 님이 1월 25일에 체크인할 예정입니다"
  new RegExp(`(?:^|[-–—:]\\s*)${NAME}\\s*님이\\s*\\d{1,2}월`),
  // "홍길동님이 메시지를 보냈습니다", "Alex 님의 새 메시지", "Penelope 님이 후기를 남겼습니다"
  new RegExp(`^${NAME}\\s*님(?:이|의|께서)?\\s*(?:새\\s*)?(?:메시지|문의|예약|요청|후기|별)`),
  // "New message from Alex", "Reservation request from Alex"
  new RegExp(`(?:message|request|inquiry|reservation)\\s+from\\s+${NAME}(?:\\s*[:\\-–—]|\\s*$)`, "i"),
  new RegExp(`^${NAME}\\s+(?:sent you|has sent|wants to book|requested)`, "i"),
];

const BODY_NAME_PATTERNS: RegExp[] = [
  // "微微 님의 예약 문의에 응답하세요", "螢님의 예약 요청에 답하세요."
  new RegExp(`^${NAME}\\s*님의\\s*(?:예약\\s*)?(?:문의|요청|메시지)`),
  // "새로운 예약이 확정되었습니다! WAI 님이 1월 25일에 체크인할 예정입니다"
  new RegExp(`!\\s*${NAME}\\s*님이\\s*\\d{1,2}월`),
  // "게스트 Yoyo 님이 12월 23일~27일 예약(HM...)을 취소했습니다"
  new RegExp(`^게스트\\s+${NAME}\\s*님이`),
  // "홍길동님이 메시지를 보냈습니다", "Kenji님이 예약을 요청했습니다"
  new RegExp(`^${NAME}\\s*님(?:이|께서)\\s*(?:메시지를\\s*보냈|문의|예약을?\\s*요청)`),
  new RegExp(`^${NAME}\\s+(?:sent you|wrote)`, "i"),
];

function extractGuestName(subject: string, lines: string[]): string | null {
  // "예약 확정 - Wai Peng 님이 ...", "대기 중: ...", "취소됨: ..." 처럼 짧은 접두어는 떼고 본다.
  const stripped = subject.replace(/^[^-–—:]{1,12}[-–—:]\s*/, "");
  for (const subj of stripped !== subject ? [stripped, subject] : [subject]) {
    for (const re of SUBJECT_NAME_PATTERNS) {
      const m = re.exec(subj);
      if (m?.[1]) {
        const name = cleanName(m[1]);
        if (name) return name;
      }
    }
  }
  const head = lines.slice(0, 40);

  // 게스트 메시지 포맷: 이름 줄 바로 다음에 "예약자"/"게스트" 역할 줄이 온다.
  const roleIdx = head.findIndex((l) => ROLE_LINE_RE.test(l));
  if (roleIdx > 0) {
    for (let i = roleIdx - 1; i >= 0; i--) {
      if (head[i] === "") continue;
      const name = cleanName(head[i]);
      if (name && name.length <= 40 && !/[#\d:：]/.test(name)) return name;
      break;
    }
  }

  for (const re of BODY_NAME_PATTERNS) {
    for (const line of head) {
      const m = re.exec(line);
      if (m?.[1]) {
        const name = cleanName(m[1]);
        if (name) return name;
      }
    }
  }
  return null;
}

function cleanName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) return null;
  if (/^(new|airbnb|your|a|the|host|guest|새|에어비앤비|예약 확정|대기 중|취소됨|게스트)$/i.test(name)) return null;
  if (/확정|취소|대기|예약/.test(name) && name.length > 6) return null;
  return name;
}

// ---------------------------------------------------------------------------
// 숙소 이름 / 리스팅 번호
// ---------------------------------------------------------------------------

function extractListingName(lines: string[]): string | null {
  // 1) 해시태그 제목 줄: "#홍대입구역 #최대6인 ... #홈씨어터"
  const tagLine = lines.find((l) => /^#\S/.test(l) && (l.match(/#/g) ?? []).length >= 2);
  if (tagLine) return tagLine.trim();

  // 2) 명시 라벨
  const patterns = [/^숙소(?: 이름)?[:：]\s*(.+)/, /^(?:Listing|Property)[:：]\s*(.+)/i];
  for (const line of lines) {
    for (const re of patterns) {
      const m = re.exec(line);
      if (m?.[1]) {
        const name = m[1].trim().replace(/^[“"'‘]+|[”"'’]+$/g, "").trim();
        if (name) return name;
      }
    }
  }
  return null;
}

function extractListingId(text: string): string | null {
  const m = LISTING_ID_RE.exec(text);
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

// ---------------------------------------------------------------------------
// 스레드 링크
// ---------------------------------------------------------------------------

function extractThread(text: string, html: string): { threadUrl: string | null; threadId: string | null } {
  let firstUrl: string | null = null;

  for (const src of [text, html]) {
    const matches = src.match(THREAD_URL_RE) ?? [];
    for (const raw of matches) {
      const url = decodeHtmlEntities(raw);
      if (!firstUrl) firstUrl = url;
      const id = THREAD_ID_RE.exec(url)?.[1] ?? ENCODED_THREAD_RE.exec(url)?.[1] ?? null;
      if (id) return { threadUrl: url, threadId: id };
    }
  }

  const encoded = ENCODED_THREAD_RE.exec(html) ?? ENCODED_THREAD_RE.exec(text);
  return { threadUrl: firstUrl, threadId: encoded?.[1] ?? null };
}

// ---------------------------------------------------------------------------
// 메시지 본문
// ---------------------------------------------------------------------------

/** 본문의 끝을 알리는 줄 (버튼, 섹션 제목, 푸터). */
const END_MARKERS: RegExp[] = [
  /^(?:예약 사전 승인|사전 승인|수락\/거절|답장|답장하기|메시지 보기|메시지 보내기|대화 보기|앱에서 보기)/,
  /^(?:Reply|View message|View in app|Pre-approve|Decline|Accept)/i,
  /^(?:체크인|체크아웃|게스트|예약 코드|자주 묻는 질문|고객지원|집 전체|개인실|Airbnb|에어비앤비|Airbnb Ireland)/,
  /^이 이메일에 직접 회신|님이 호스팅하는 집/,
  /^(?:문의 확인하기|예약 확인하기|원문 보기)$/,
  /^#\S/, // 해시태그 숙소 제목
  /^\d{1,2}월 \d{1,2}일|^\d{4}년/,
  /24시간 이내에 응답/,
  /^(?:본 메일은|이 이메일은|This email was sent|You are receiving)/,
];

/**
 * 게스트 메시지 포맷의 역할 줄. 이름 아래, 본문 위.
 * "게스트" 는 다른 포맷에서 인원수 섹션 제목("게스트 / 성인 5명")으로도 쓰여서 넣지 않는다.
 */
const ROLE_LINE_RE = /^(?:예약자|Booker|Guest)$/i;

/** 본문의 시작 직전 줄. 우선순위 순. */
const START_MARKERS: RegExp[] = [
  ROLE_LINE_RE, // 게스트 메시지: "예나 / 예약자 / (본문) / 답장 보내기"
  /^에어비앤비 가입 연도/, // 숙박 문의: 프로필 블록의 마지막 줄
  /^본인 인증 완료/, // 가입 연도 줄이 없는 변형. 바로 아래에 "도시, 나라" 줄이 올 수 있다.
  /^(?:메시지|새 메시지|문의 내용|Message)[:：]?$/i,
  /(?:메시지를 보냈습니다|sent you a message|wrote)[:：]?$/i,
];

/** 프로필 블록의 "Taoyuan City, 대만" 같은 위치 줄. 문장 부호 없이 "X, Y" 한 줄. */
const LOCATION_LINE_RE = /^[^,?!。.:]{2,40}, [^,?!。.:]{2,24}$/;

function extractMessageBody(lines: string[], guestName: string | null): string | null {
  const markers = [...START_MARKERS];
  if (guestName) {
    markers.push(new RegExp(`^${escapeRe(guestName)}\\s*(?:님(?:의|이)?|:|wrote|says)`, "i"));
  }

  let start = -1;
  let afterProfile = false;
  for (const re of markers) {
    const idx = lines.findIndex((l) => re.test(l));
    if (idx !== -1) {
      start = idx + 1;
      afterProfile = re === START_MARKERS[2];
      break;
    }
  }

  // "본인 인증 완료" 다음에 오는 위치 줄("도시, 나라")은 프로필이지 메시지가 아니다.
  if (afterProfile) {
    while (start < lines.length && (lines[start] === "" || LOCATION_LINE_RE.test(lines[start]))) start++;
    // "홍콩" 처럼 쉼표 없는 짧은 위치 한 줄: 그 뒤에 다른 문단이 더 있을 때만 프로필로 보고 건너뛴다.
    const first = lines[start] ?? "";
    if (first.length <= 30 && !/[.?!~。？！]/.test(first)) {
      let j = start + 1;
      while (j < lines.length && lines[j] === "") j++;
      if (j < lines.length && !END_MARKERS.some((re) => re.test(lines[j]))) start = j;
    }
  }

  // 시작 마커를 못 찾으면 첫 "문장처럼 보이는" 줄부터
  if (start === -1) {
    start = lines.findIndex(
      (l) => l.length >= 10 && !/^(?:https?:|안녕하세요|hi\b|hello\b)/i.test(l) && !END_MARKERS.some((re) => re.test(l))
    );
    if (start === -1) return null;
  }

  const body: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (END_MARKERS.some((re) => re.test(line))) break;
    if (line === "" && (body.length === 0 || body[body.length - 1] === "")) continue;
    body.push(line);
  }

  // 호스트 본인이 보낸 직전 메시지("You: ...")가 앞에 붙어 오면 제외한다.
  while (body.length && /^(?:you|나|호스트|host)\s*:/i.test(body[0])) {
    while (body.length && body[0] !== "") body.shift();
    while (body.length && body[0] === "") body.shift();
  }

  const joined = body
    .join("\n")
    .replace(/[�]+/g, "") // 깨진 이모지 치환 문자
    .trim();
  return joined.length > 0 ? joined.slice(0, 4000) : null;
}

// ---------------------------------------------------------------------------
// 날짜
// ---------------------------------------------------------------------------

const MONTHS_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function extractDates(subject: string, text: string): { checkIn: string | null; checkOut: string | null } {
  // 1) 제목/본문의 기간 표기: "2026년 12월 23일~27일", "2026년 12월 30일~1월 2일"
  const rangeRe = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*[~～\-–]\s*(?:(\d{1,2})월\s*)?(\d{1,2})일/;
  for (const src of [subject, text]) {
    const m = rangeRe.exec(src);
    if (m) {
      const y = Number(m[1]);
      const m1 = Number(m[2]);
      const d1 = Number(m[3]);
      const m2 = m[4] ? Number(m[4]) : m1;
      const d2 = Number(m[5]);
      const y2 = m2 < m1 ? y + 1 : y;
      return { checkIn: iso(y, m1, d1), checkOut: iso(y2, m2, d2) };
    }
  }

  // 2) "체크인 ... 체크아웃" 표 아래의 날짜 두 개 (연도 있는 형식)
  const fullKo = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g;
  const found: string[] = [];
  for (const m of text.matchAll(fullKo)) found.push(iso(Number(m[1]), Number(m[2]), Number(m[3])));
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) found.push(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of text.matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi)) {
    const month = MONTHS_EN.indexOf(m[1].slice(0, 3).toLowerCase());
    if (month >= 0) found.push(iso(Number(m[3]), month + 1, Number(m[2])));
  }
  // 체크인/체크아웃 섹션 근처의 것만 신뢰: 둘 다 있을 때만 반환
  const unique = [...new Set(found)].sort();
  if (unique.length >= 2) return { checkIn: unique[0], checkOut: unique[1] };

  // 3) 연도 없는 "12월 23일 (수)   12월 27일 (일)" 은 메일 날짜를 모르므로 추정하지 않는다.
  return { checkIn: null, checkOut: null };
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
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

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

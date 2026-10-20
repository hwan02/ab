/**
 * 키워드 자동응답 규칙: 매칭과 답변 렌더링. 순수 함수만 있어서 서버/클라이언트/테스트에서 같이 쓴다.
 *
 * 매칭: 메시지와 키워드를 소문자로 바꾸고 공백·문장부호를 없앤 뒤 부분 일치. 여러 규칙이 걸리면
 *       priority 가 높은 것, 같으면 더 많은 키워드가 걸린 것, 그래도 같으면 먼저 등록한 것.
 * 렌더: 답변 안의 {게스트이름} {숙소명} {체크인} {체크아웃} {체크인시간} {체크아웃시간}
 *       {와이파이이름} {와이파이비밀번호} {주소} 를 채운다. 값이 없으면 빈 문자열.
 */

export interface ReplyRule {
  id: string;
  property_id: string;
  name: string;
  keywords: string[];
  answer: string;
  answer_en: string | null;
  priority: number;
  enabled: boolean;
}

export interface ReplyContext {
  guestName?: string | null;
  propertyName?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  checkinTime?: string | null;
  checkoutTime?: string | null;
  wifiSsid?: string | null;
  wifiPassword?: string | null;
  address?: string | null;
}

export interface MatchResult {
  rule: ReplyRule;
  matchedKeywords: string[];
}

/** 비교용 정규화: 소문자, 공백/문장부호 제거. "Wi-Fi 비밀번호" → "wifi비밀번호" */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s\-_·.,!?~:;()\[\]{}'"“”‘’…]/g, "")
    .trim();
}

/** 번역 블록이 있으면 번역문(한국어)과 원문을 모두 매칭 대상에 넣는다. */
export function matchRule(message: string, rules: ReplyRule[]): MatchResult | null {
  const haystack = normalizeForMatch(message);
  if (!haystack) return null;

  let best: (MatchResult & { index: number }) | null = null;
  rules.forEach((rule, index) => {
    if (!rule.enabled) return;
    const matched = rule.keywords.map((k) => k.trim()).filter((k) => k.length > 0 && haystack.includes(normalizeForMatch(k)));
    if (matched.length === 0) return;
    const candidate = { rule, matchedKeywords: matched, index };
    if (
      !best ||
      rule.priority > best.rule.priority ||
      (rule.priority === best.rule.priority && matched.length > best.matchedKeywords.length)
    ) {
      best = candidate;
    }
  });
  if (!best) return null;
  const { rule, matchedKeywords } = best as MatchResult & { index: number };
  return { rule, matchedKeywords };
}

/** 게스트 원문이 한글이 아니고 영어 답변이 있으면 영어 답변을 쓴다. */
export function pickAnswer(rule: ReplyRule, message: string): string {
  if (rule.answer_en && rule.answer_en.trim() && !isKoreanOriginal(message)) return rule.answer_en;
  return rule.answer;
}

/**
 * 메시지의 원문 언어가 한국어인지. 에어비앤비 알림은 한국어 번역 + "원문에서 자동 번역된 메시지:" + 원문 순서라,
 * 번역 블록이 있으면 그 아래 원문을 보고, 없으면 메시지 전체를 본다.
 */
export function isKoreanOriginal(message: string): boolean {
  const parts = message.split(/원문에서 자동 번역된 메시지\s*[:：]?/);
  const original = parts.length > 1 ? parts[parts.length - 1] : message;
  const hangul = (original.match(/[가-힣]/g) ?? []).length;
  const letters = (original.match(/[A-Za-z가-힣぀-ヿ一-鿿]/g) ?? []).length;
  if (letters === 0) return true;
  return hangul / letters >= 0.3;
}

const VARIABLES: { token: string; key: keyof ReplyContext }[] = [
  { token: "{게스트이름}", key: "guestName" },
  { token: "{숙소명}", key: "propertyName" },
  { token: "{체크인}", key: "checkIn" },
  { token: "{체크아웃}", key: "checkOut" },
  { token: "{체크인시간}", key: "checkinTime" },
  { token: "{체크아웃시간}", key: "checkoutTime" },
  { token: "{와이파이이름}", key: "wifiSsid" },
  { token: "{와이파이비밀번호}", key: "wifiPassword" },
  { token: "{주소}", key: "address" },
];

export const ANSWER_VARIABLES = VARIABLES.map((v) => v.token);

export function renderAnswer(template: string, ctx: ReplyContext): string {
  let out = template;
  for (const { token, key } of VARIABLES) {
    const value = ctx[key];
    out = out.split(token).join(value ? String(value) : "");
  }
  return out.replace(/[ \t]+\n/g, "\n").trim();
}

/** "규칙으로 만들기" 용 키워드 후보: 메시지에서 2글자 이상 단어를 빈도 없이 앞에서부터 최대 6개. */
export function suggestKeywords(message: string): string[] {
  const stop = new Set(["안녕하세요", "감사합니다", "혹시", "있나요", "있을까요", "되나요", "될까요", "있는지", "please", "thanks", "hello", "the", "and", "can", "you", "is"]);
  const words = message
    .split(/원문에서 자동 번역된 메시지/)[0]
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !stop.has(w.toLowerCase()));
  const uniq: string[] = [];
  for (const w of words) if (!uniq.includes(w)) uniq.push(w);
  return uniq.slice(0, 6);
}

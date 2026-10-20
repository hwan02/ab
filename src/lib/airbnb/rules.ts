/**
 * 키워드 자동응답 규칙: 매칭과 답변 렌더링. 순수 함수만 있어서 서버/클라이언트/테스트에서 같이 쓴다.
 *
 * 매칭: 메시지에서 번역 라벨("원문에서 자동 번역된 메시지:")을 뺀 뒤,
 *       - 라틴 문자 키워드("check in", "wifi")는 단어 시작 경계로 맞추되, 각 단어 뒤에 흔한 활용 접미사
 *         (s/es/ed/ing/er/ion/ation/al/ly, 끝자음 중복, 끝 e 탈락)는 허용한다. "check in" 은 "check-in"/"checkin"/
 *         "checked in" 에 걸리고 "checking" 에는 안 걸린다. "bed" 는 "beds", "cancel" 은 "cancellation",
 *         "arrive" 는 "arriving" 에 걸린다. 글자 사이 구분자(공백·하이픈 등)는 단어 안 1개, 단어 사이 3개까지만 본다.
 *       - 한글·한자 등 키워드는 소문자로 바꾸고 공백·문장부호를 없앤 뒤 부분 일치.
 *       - 한글 1글자 키워드("짐")는 앞뒤가 한글이 아닐 때만 걸린다. "아침" 의 "침" 같은 오탐을 막는다.
 *       여러 규칙이 걸리면 priority 가 높은 것, 같으면 더 많은 키워드가 걸린 것, 그래도 같으면 먼저 등록한 것.
 * 언어: 게스트 원문 언어를 ko/en/zh/ja 로 감지하고 그 언어의 answer_{lang} 을 보낸다. 없으면 en, 그것도 없으면 ko.
 * 렌더: 답변 안의 {게스트이름} {숙소명} {체크인} {체크아웃} {체크인시간} {체크아웃시간}
 *       {와이파이이름} {와이파이비밀번호} {주소} 를 채운다. 값이 없으면 빈 문자열.
 */

export type AnswerLang = "ko" | "en" | "zh" | "ja";

export const ANSWER_LANGS: AnswerLang[] = ["ko", "en", "zh", "ja"];

export const ANSWER_LANG_LABELS: Record<AnswerLang, string> = {
  ko: "한국어",
  en: "영어",
  zh: "중국어",
  ja: "일본어",
};

export interface ReplyRule {
  id: string;
  property_id: string;
  name: string;
  keywords: string[];
  answer: string;
  answer_en: string | null;
  answer_zh?: string | null;
  answer_ja?: string | null;
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

/** 에어비앤비 알림 메일의 번역 라벨. 한국어 번역 + 라벨 + 원문 순서로 온다. */
const TRANSLATION_LABEL_RE = /원문에서 자동 번역된 메시지\s*[:：]?/g;

const HANGUL_RE = /[가-힣]/;

/** 비교용 정규화: 소문자, 공백/문장부호 제거. "Wi-Fi 비밀번호" → "wifi비밀번호" */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s\-_·.,!?~:;()\[\]{}'"“”‘’…]/g, "")
    .trim();
}

/** 매칭 대상에서 번역 라벨을 뺀 본문. 라벨 줄 자체가 키워드("메시지")에 걸리는 오탐을 막는다. */
export function stripTranslationLabel(message: string): string {
  return message.replace(TRANSLATION_LABEL_RE, " ");
}

/** 번역 블록이 있으면 그 아래 원문, 없으면 메시지 전체. */
export function originalText(message: string): string {
  const parts = message.split(/원문에서 자동 번역된 메시지\s*[:：]?/);
  return parts.length > 1 ? parts[parts.length - 1] : message;
}

/** 라틴 문자(영문·숫자)와 구분자만으로 된 키워드인지. "check-in", "wi fi", "6011" */
function isLatinKeyword(keyword: string): boolean {
  return /^[A-Za-z0-9]+(?:[\s\-_·.,'’]+[A-Za-z0-9]+)*$/.test(keyword.trim());
}

/** 라틴 키워드 단어 사이에 올 수 있는 구분자(줄바꿈 포함). 최대 3개("check - in"). */
const LATIN_SEP = "[\\s\\-_.·'’]";
/** 단어 안 글자 사이에 올 수 있는 구분자(줄바꿈 제외). 최대 1개("wi-fi", "w i f i"). */
const LATIN_INNER_SEP = "[ \\-_.·'’]";
/** 단어 뒤에 허용하는 활용 접미사. 긴 것부터 둬야 백트래킹 없이 가장 긴 것이 먼저 잡힌다. */
const LATIN_SUFFIX = "(?:ations|ation|ions|ion|ings|ing|ers|er|es|ed|ly|al|s)?";

/**
 * 라틴 키워드 한 단어("check", "arrive")의 정규식 조각.
 *  - 글자 사이 구분자 1개 허용: "wifi" ↔ "wi-fi"
 *  - 끝 e 는 생략 가능(arrive → arriving), 끝 자음은 중복 가능(cancel → cancellation, stop → stopped)
 *  - 뒤에 접미사 허용(LATIN_SUFFIX). 숫자로 끝나는 단어("6011")에는 접미사를 붙이지 않는다.
 */
function latinWordPattern(word: string): string {
  const chars = word.split("");
  const last = chars[chars.length - 1];
  if (!/[a-z]/.test(last)) return chars.join(`${LATIN_INNER_SEP}?`);
  const head = chars.slice(0, -1).join(`${LATIN_INNER_SEP}?`);
  const joiner = head ? `${LATIN_INNER_SEP}?` : "";
  if (last === "e") return `${head}${joiner}e?${LATIN_SUFFIX}`;
  const doubled = /[aeiou]/.test(last) ? "" : `${last}?`;
  return `${head}${joiner}${last}${doubled}${LATIN_SUFFIX}`;
}

/**
 * 라틴 키워드용 정규식: 단어 시작 경계(\b)에서 시작해 단어 끝 경계에서 끝난다.
 * "wifi" → wi-fi 에 걸리고, "check in" → check-in / checkin / checked in 에 걸리되 "checking" 에는 안 걸린다.
 * "bed" → beds, "cancel" → cancellation, "arrive" → arriving, "walk" → walking 처럼 활용형은 걸린다.
 */
function latinKeywordRegex(keyword: string): RegExp | null {
  const words = keyword.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return null;
  return new RegExp(`\\b${words.map(latinWordPattern).join(`${LATIN_SEP}{0,3}`)}\\b`);
}

/** 한글 1글자 키워드: 앞뒤가 한글이 아닌 자리에 있을 때만 맞는 것으로 본다. */
function matchesSingleHangul(haystack: string, ch: string): boolean {
  let from = 0;
  for (;;) {
    const i = haystack.indexOf(ch, from);
    if (i < 0) return false;
    const before = i > 0 ? haystack[i - 1] : "";
    const after = i + 1 < haystack.length ? haystack[i + 1] : "";
    if (!HANGUL_RE.test(before) && !HANGUL_RE.test(after)) return true;
    from = i + 1;
  }
}

/** 키워드 하나가 메시지에 걸리는지. message 는 라벨을 뺀 원문(소문자화 전). */
export function keywordMatches(message: string, keyword: string): boolean {
  const k = keyword.trim();
  if (!k) return false;
  if (isLatinKeyword(k)) {
    const re = latinKeywordRegex(k);
    return !!re && re.test(message.toLowerCase());
  }
  const normalized = normalizeForMatch(k);
  if (!normalized) return false;
  if (normalized.length === 1 && HANGUL_RE.test(normalized)) {
    return matchesSingleHangul(message, normalized);
  }
  return normalizeForMatch(message).includes(normalized);
}

/** 번역 블록이 있으면 번역문(한국어)과 원문을 모두 매칭 대상에 넣는다(라벨 줄은 제외). */
export function matchRule(message: string, rules: ReplyRule[]): MatchResult | null {
  const body = stripTranslationLabel(message);
  if (!normalizeForMatch(body)) return null;

  let best: (MatchResult & { index: number }) | null = null;
  rules.forEach((rule, index) => {
    if (!rule.enabled) return;
    const matched = rule.keywords.map((k) => k.trim()).filter((k) => keywordMatches(body, k));
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

/**
 * 게스트 원문 언어 감지. 번역 블록이 있으면 라벨 아래 원문만 본다.
 *  - 가나(히라가나·가타카나)가 있으면 ja
 *  - 한글 없이 한자만이면 zh
 *  - 라틴 문자 위주(60% 이상)면 en
 *  - 그 외(한글, 글자 없음, 섞임)는 ko
 */
export function detectLanguage(message: string): AnswerLang {
  const original = originalText(message);
  const kana = (original.match(/[぀-ヿ]/g) ?? []).length;
  if (kana > 0) return "ja";
  const hangul = (original.match(/[가-힣]/g) ?? []).length;
  const han = (original.match(/[一-鿿]/g) ?? []).length;
  const latin = (original.match(/[A-Za-z]/g) ?? []).length;
  if (han > 0 && hangul === 0 && han >= latin) return "zh";
  const letters = hangul + han + latin;
  if (letters > 0 && latin / letters >= 0.6) return "en";
  return "ko";
}

/** 메시지의 원문 언어가 한국어인지. (detectLanguage 의 축약) */
export function isKoreanOriginal(message: string): boolean {
  return detectLanguage(message) === "ko";
}

function nonEmpty(s: string | null | undefined): string | null {
  return s && s.trim() ? s : null;
}

/** 언어별 답변을 고른다: answer_{lang} → answer_en → answer(한국어). 실제로 쓰인 언어도 돌려준다. */
export function pickAnswerForLang(rule: ReplyRule, lang: AnswerLang): { text: string; answerLang: AnswerLang } {
  if (lang !== "ko") {
    const own = lang === "en" ? nonEmpty(rule.answer_en) : lang === "zh" ? nonEmpty(rule.answer_zh) : nonEmpty(rule.answer_ja);
    if (own) return { text: own, answerLang: lang };
    const en = nonEmpty(rule.answer_en);
    if (en) return { text: en, answerLang: "en" };
  }
  return { text: rule.answer, answerLang: "ko" };
}

/** 게스트 원문 언어를 감지해 그 언어의 답변을 고른다. 감지 언어와 실제 나가는 언어를 함께 돌려준다. */
export function pickAnswerWithLang(rule: ReplyRule, message: string): { text: string; detected: AnswerLang; answerLang: AnswerLang } {
  const detected = detectLanguage(message);
  const { text, answerLang } = pickAnswerForLang(rule, detected);
  return { text, detected, answerLang };
}

/** 게스트 원문 언어에 맞는 답변. 언어별 답변 → 영어 → 한국어 순. */
export function pickAnswer(rule: ReplyRule, message: string): string {
  return pickAnswerWithLang(rule, message).text;
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

/**
 * 번역 전에 변수 토큰을 자리표시(⟦n⟧)로 바꾼다. 번역기가 {게스트이름} 을 번역해 버리는 것을 막는다.
 * protectVariables 로 바꾸고, 번역 결과를 restoreVariables 로 되돌린다. 자리표시가 깨졌으면 null.
 */
export function protectVariables(text: string): { text: string; tokens: string[] } {
  const tokens: string[] = [];
  const re = new RegExp(ANSWER_VARIABLES.map((t) => t.replace(/[{}]/g, "\\$&")).join("|"), "g");
  const protectedText = text.replace(re, (token) => {
    tokens.push(token);
    return `⟦${tokens.length}⟧`;
  });
  return { text: protectedText, tokens };
}

export function restoreVariables(translated: string, tokens: string[]): string | null {
  const seen = new Set<number>();
  let duplicated = false;
  const out = translated.replace(/⟦\s*(\d+)\s*⟧/g, (_, n: string) => {
    const idx = Number(n) - 1;
    if (idx < 0 || idx >= tokens.length) return "\u0000";
    if (seen.has(idx)) duplicated = true;
    seen.add(idx);
    return tokens[idx];
  });
  // 번호가 빠지거나 중복되면(번역기가 자리표시를 떨어뜨리거나 복제한 경우) 변수가 유실된 것이므로 실패로 본다.
  if (duplicated || out.includes("\u0000") || /[⟦⟧]/.test(out) || seen.size !== tokens.length) return null;
  return out;
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

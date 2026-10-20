/**
 * 메일 동기화에서 쓰는 순수 함수. DB/네트워크 없이 서버·테스트에서 같이 쓴다.
 *
 * - matchProperty: 알림 메일의 숙소 제목(listing_name)으로 어느 숙소인지 찾는다.
 * - twinKey: automated@ / express@ 두 통으로 오는 같은 메시지를 한 건으로 묶는 키.
 */

/** 수신함 숙소 필터(?property=)에서 '숙소 미확정' 그룹을 뜻하는 값. 관리자만 쓴다. */
export const UNMAPPED_FILTER = "unmapped";

export interface MatchableProperty {
  id: string;
  name: string;
  airbnb_listing_title?: string | null;
}

export type MatchReason =
  /** 메일에 숙소 제목이 없음 */
  | "no_listing"
  /** 정규화 완전 일치 */
  | "exact"
  /** 한쪽이 다른 쪽을 포함 */
  | "contains"
  /** 해시태그 2개 이상 겹침 */
  | "tags"
  /** 후보가 둘 이상 동점이라 정하지 않음 */
  | "ambiguous"
  /** 맞는 숙소 없음 */
  | "none";

export interface PropertyMatch<T extends MatchableProperty> {
  property: T | null;
  reason: MatchReason;
  /** reason 이 ambiguous 일 때 동점 후보들. */
  candidates: T[];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
const tags = (s: string) => new Set((s.toLowerCase().match(/#[^\s#]+/g) ?? []).map((t) => t.replace(/\s+/g, "")));

/**
 * 메일의 숙소 제목과 숙소를 맞춘다.
 *
 * 1) airbnb_listing_title 이 있는 숙소끼리: 정규화 완전 일치 → 포함(긴 쪽 우선) → 해시태그 2개 이상 겹침 중 최고 점수.
 *    어느 단계든 후보가 둘 이상 동점이면 매핑하지 않는다(ambiguous).
 * 2) 1) 에서 아무것도 안 걸렸을 때만, airbnb_listing_title 이 비어 있는 숙소를 name 으로 같은 방식.
 *
 * 숙소가 하나뿐이라고 그냥 붙이지 않는다. 제목이 안 맞으면 호스트가 리스팅 제목을 고쳐야 한다.
 */
export function matchProperty<T extends MatchableProperty>(listingName: string | null, properties: T[]): PropertyMatch<T> {
  if (!listingName || !listingName.trim()) return { property: null, reason: "no_listing", candidates: [] };

  const needle = norm(listingName);
  const mailTags = tags(listingName);
  if (!needle) return { property: null, reason: "no_listing", candidates: [] };

  const withTitle = properties.filter((p) => !!p.airbnb_listing_title && p.airbnb_listing_title.trim().length > 0);
  const withoutTitle = properties.filter((p) => !withTitle.includes(p));

  const first = matchBy(
    needle,
    mailTags,
    withTitle.map((p) => ({ p, value: p.airbnb_listing_title as string }))
  );
  if (first.reason !== "none") return first;

  return matchBy(
    needle,
    mailTags,
    withoutTitle.map((p) => ({ p, value: p.name }))
  );
}

function matchBy<T extends MatchableProperty>(needle: string, mailTags: Set<string>, entries: { p: T; value: string }[]): PropertyMatch<T> {
  const rows = entries.map((e) => ({ p: e.p, value: norm(e.value), tags: tags(e.value) })).filter((r) => r.value.length > 0);
  if (rows.length === 0) return { property: null, reason: "none", candidates: [] };

  const exact = rows.filter((r) => r.value === needle);
  if (exact.length === 1) return { property: exact[0].p, reason: "exact", candidates: [] };
  if (exact.length > 1) return { property: null, reason: "ambiguous", candidates: exact.map((r) => r.p) };

  // 포함: 겹치는 길이가 긴 쪽이 더 구체적인 매칭이다. 같은 길이면 정하지 않는다.
  const contains = rows
    .filter((r) => needle.includes(r.value) || r.value.includes(needle))
    .map((r) => ({ ...r, score: Math.min(r.value.length, needle.length) }));
  if (contains.length > 0) {
    const top = Math.max(...contains.map((r) => r.score));
    const best = contains.filter((r) => r.score === top);
    if (best.length === 1) return { property: best[0].p, reason: "contains", candidates: [] };
    return { property: null, reason: "ambiguous", candidates: best.map((r) => r.p) };
  }

  if (mailTags.size > 0) {
    const scored = rows
      .map((r) => ({ ...r, score: [...r.tags].filter((t) => mailTags.has(t)).length }))
      .filter((r) => r.score >= 2);
    if (scored.length > 0) {
      const top = Math.max(...scored.map((r) => r.score));
      const best = scored.filter((r) => r.score === top);
      if (best.length === 1) return { property: best[0].p, reason: "tags", candidates: [] };
      return { property: null, reason: "ambiguous", candidates: best.map((r) => r.p) };
    }
  }

  return { property: null, reason: "none", candidates: [] };
}

/** 같은 스레드의 같은 본문을 한 건으로 묶는 키. 본문이 없으면 묶지 않는다. */
export function twinKey(threadId: string | null, messageText: string | null): string | null {
  if (!threadId || !messageText) return null;
  const text = messageText
    .split(/\n\s*원문에서 자동 번역된 메시지/)[0] // express@ 쪽에만 붙는 번역 블록은 뺀다
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return text ? `${threadId}|${text}` : null;
}

/** 에어비앤비 리스팅 제목이 보통 쓰는 해시태그 형식("#홍대입구역 #최대6인 …")인지. 안내용이라 느슨하게 본다. */
export function looksLikeHashtagTitle(title: string): boolean {
  return title.trim().startsWith("#");
}

/**
 * 예약 확정 전(문의) 스레드인지. 에어비앤비는 예약 확정 전 게스트에게 링크·사진·동영상 전송을 막는다.
 * - 문의 스레드 메일 제목: "… 숙박 문의", "RE: … 리스팅 예약(기간) 관련 문의"
 * - 확정 예약 스레드 제목: "RE: … 예약(기간)" (문의 없음)
 * 제목만으로 애매하면 같은 스레드에 '예약 확정' 메일이 있었는지(hasConfirmedReservation)로 판단한다.
 */
export function isInquiryThread(subject: string, hasConfirmedReservation: boolean): boolean {
  if (hasConfirmedReservation) return false;
  return /문의|inquiry/i.test(subject);
}

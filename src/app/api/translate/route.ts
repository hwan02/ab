import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { identify } from "@/lib/airbnb/authz";

/**
 * 한국어 → 다른 언어 번역(Google Translate v2) + translations 테이블 캐시.
 *
 * 권한
 *  - 로그인 세션 또는 Authorization: Bearer $CRON_SECRET → 허용 (호스트 규칙 화면의 답변 번역 등)
 *  - 익명 → 허용하되 IP 당 레이트 리밋. 게스트용 공개 페이지(/property/[id], /faq 등)가 AutoTranslate 컴포넌트로
 *    비로그인 상태에서 이 API 를 쓰기 때문에 막을 수 없다. 대신 Google 호출이 필요한 분량(DB 캐시 미스)만 센다.
 *    캐시 히트는 비용이 없으므로 제한에 걸린 뒤에도 전부 캐시된 요청은 그대로 응답한다.
 *  - 입력은 texts 글자 수 합계 5,000자, 200개까지.
 *
 * 오류 응답은 JSON 이 아닌 text/plain 으로 보낸다. AutoTranslate(src/components/i18n/AutoTranslate.tsx)는
 * JSON 응답이면 `translations ?? texts` 로 한국어 원문을 "번역 결과"로 localStorage 에 영구 저장하지만,
 * JSON 파싱이 실패하면 원문을 그 자리에서만 쓰고 저장하지 않는다. 그래서 한 번 제한·크기 초과·Google 장애에
 * 걸려도 다음 방문에서 다시 번역을 시도한다.
 *
 * 알려진 한계: AutoTranslate 는 한 렌더 커밋에 모인 텍스트를 나누지 않고 한 요청으로 보내므로,
 * 숙소 설명·FAQ·주변 장소가 합쳐서 5,000자 또는 200개를 넘는 페이지는 그 배치 전체가 번역되지 않는다
 * (영구 고정은 아니고 그 방문에서만). 그런 숙소가 생기면 AutoTranslate 쪽에서 배치를 나누는 것이 후속 작업.
 *
 * 캐시 쓰기는 서비스 롤로만 한다(translations 에 anon/authenticated INSERT/UPDATE 정책이 없음).
 * 서비스 롤 키가 없으면 캐시 저장을 건너뛰고 번역 결과만 돌려준다.
 */

const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

const MAX_TOTAL_CHARS = 5000;
const MAX_TEXTS = 200;
const ALLOWED_TARGET = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

/**
 * 익명 레이트 리밋: IP 당 창(window) 안에서 Google 호출 횟수·글자 수(캐시 미스분만) 제한.
 * 인스턴스 메모리라 서버리스에서는 인스턴스별로 센다(최선 노력).
 * 한 IP 를 여러 게스트가 공유(통신사 CGNAT, 숙소·호텔 와이파이)하는 것이 보통이라 넉넉히 둔다.
 * 50,000자 ≈ Google 번역 요금 약 $1 이 10분당 IP 하나의 최대 비용.
 */
const ANON_WINDOW_MS = 10 * 60 * 1000;
const ANON_MAX_REQUESTS = 120;
const ANON_MAX_CHARS = 50000;
const anonBuckets = new Map<string, { resetAt: number; requests: number; chars: number }>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Google 호출 1회(chars 글자)를 이 IP 의 예산에서 쓴다. 예산을 넘으면 false (이번 호출은 세지 않는다). */
function anonConsume(ip: string, chars: number): boolean {
  const now = Date.now();
  if (anonBuckets.size > 5000) {
    for (const [k, v] of anonBuckets) if (v.resetAt <= now) anonBuckets.delete(k);
  }
  let b = anonBuckets.get(ip);
  if (!b || b.resetAt <= now) {
    b = { resetAt: now + ANON_WINDOW_MS, requests: 0, chars: 0 };
    anonBuckets.set(ip, b);
  }
  if (b.requests + 1 > ANON_MAX_REQUESTS || b.chars + chars > ANON_MAX_CHARS) return false;
  b.requests += 1;
  b.chars += chars;
  return true;
}

/** 오류는 text/plain 으로. (위 설명: AutoTranslate 가 원문을 영구 캐시하지 않게) */
function fail(message: string, status: number) {
  return new NextResponse(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function adminOrNull() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request", 400);
  }
  const { texts, target } = (body ?? {}) as { texts?: unknown; target?: unknown };

  if (!Array.isArray(texts) || typeof target !== "string" || !ALLOWED_TARGET.test(target) || texts.length > MAX_TEXTS) {
    return fail("Invalid request", 400);
  }
  if (!texts.every((t): t is string => typeof t === "string")) {
    return fail("Invalid request", 400);
  }
  const totalChars = texts.reduce((n, t) => n + t.length, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return fail(`Too long (max ${MAX_TOTAL_CHARS} chars)`, 413);
  }

  if (!GOOGLE_TRANSLATE_API_KEY) {
    return fail("Translation not configured", 503);
  }

  if (target === "ko" || texts.length === 0) {
    return NextResponse.json({ translations: texts });
  }

  const targetLang = target === "zh" ? "zh-CN" : target;
  const admin = adminOrNull();
  const reader = admin ?? (await createClient());

  // 1. Check DB cache first
  const results: string[] = new Array(texts.length).fill("");
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  const { data: cached } = await reader
    .from("translations")
    .select("source_text, translated_text")
    .eq("target_lang", targetLang)
    .in("source_text", texts);

  const cacheMap = new Map<string, string>();
  (cached ?? []).forEach((row) => {
    cacheMap.set(row.source_text, row.translated_text);
  });

  for (let i = 0; i < texts.length; i++) {
    const hit = cacheMap.get(texts[i]);
    if (hit) {
      results[i] = hit;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]);
    }
  }

  if (uncachedTexts.length === 0) {
    return NextResponse.json({ translations: results });
  }

  // 2. 익명이면 Google 호출이 필요한 분량(캐시 미스)만 예산에서 센다.
  const actor = await identify(req);
  if (!actor) {
    const uncachedChars = uncachedTexts.reduce((n, t) => n + t.length, 0);
    if (!anonConsume(clientIp(req), uncachedChars)) {
      return fail("Too many requests", 429);
    }
  }

  // 3. Translate only uncached texts via Google API
  try {
    const params = new URLSearchParams({
      key: GOOGLE_TRANSLATE_API_KEY,
      target: targetLang,
      source: "ko",
      format: "text",
    });
    uncachedTexts.forEach((t) => params.append("q", t));

    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?${params.toString()}`, { method: "POST" });

    const data = await res.json();

    if (!data.data?.translations) {
      return fail("Translation failed", 502);
    }

    const rowsToInsert: { source_text: string; target_lang: string; translated_text: string }[] = [];

    data.data.translations.forEach((t: { translatedText: string }, idx: number) => {
      const originalIdx = uncachedIndices[idx];
      const translated = t.translatedText;
      results[originalIdx] = translated;

      rowsToInsert.push({
        source_text: uncachedTexts[idx],
        target_lang: targetLang,
        translated_text: translated,
      });
    });

    // 4. Save to DB cache (best effort, 서비스 롤만)
    if (admin && rowsToInsert.length > 0) {
      try {
        await admin.from("translations").upsert(rowsToInsert, { onConflict: "source_text,target_lang" });
      } catch {
        // 캐시 저장 실패는 무시
      }
    }
  } catch {
    return fail("Translation failed", 502);
  }

  return NextResponse.json({ translations: results });
}

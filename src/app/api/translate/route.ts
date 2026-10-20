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
 *    비로그인 상태에서 이 API 를 쓰기 때문에 막을 수 없다. 대신 요청 수와 글자 수를 제한한다.
 *  - 입력은 texts 글자 수 합계 5,000자까지.
 *
 * 캐시 쓰기는 서비스 롤로 한다(translations INSERT 정책이 익명 불가로 바뀜). 서비스 롤 키가 없으면
 * 세션 클라이언트로 시도하고, 실패해도 번역 결과는 그대로 돌려준다.
 */

const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

const MAX_TOTAL_CHARS = 5000;
const MAX_TEXTS = 200;
const ALLOWED_TARGET = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

/** 익명 레이트 리밋: IP 당 창(window) 안에서 요청 수·글자 수 제한. 인스턴스 메모리라 서버리스에서는 인스턴스별로 센다(최선 노력). */
const ANON_WINDOW_MS = 10 * 60 * 1000;
const ANON_MAX_REQUESTS = 60;
const ANON_MAX_CHARS = 20000;
const anonBuckets = new Map<string, { resetAt: number; requests: number; chars: number }>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function anonAllowed(ip: string, chars: number): boolean {
  const now = Date.now();
  if (anonBuckets.size > 5000) {
    for (const [k, v] of anonBuckets) if (v.resetAt <= now) anonBuckets.delete(k);
  }
  let b = anonBuckets.get(ip);
  if (!b || b.resetAt <= now) {
    b = { resetAt: now + ANON_WINDOW_MS, requests: 0, chars: 0 };
    anonBuckets.set(ip, b);
  }
  b.requests += 1;
  b.chars += chars;
  return b.requests <= ANON_MAX_REQUESTS && b.chars <= ANON_MAX_CHARS;
}

async function cacheClient() {
  try {
    return createAdminClient();
  } catch {
    return createClient();
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { texts, target } = (body ?? {}) as { texts?: unknown; target?: unknown };

  if (!Array.isArray(texts) || typeof target !== "string" || !ALLOWED_TARGET.test(target) || texts.length > MAX_TEXTS) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!texts.every((t): t is string => typeof t === "string")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const totalChars = texts.reduce((n, t) => n + t.length, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return NextResponse.json({ error: `Too long (max ${MAX_TOTAL_CHARS} chars)` }, { status: 413 });
  }

  const actor = await identify(req);
  if (!actor && !anonAllowed(clientIp(req), totalChars)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!GOOGLE_TRANSLATE_API_KEY) {
    return NextResponse.json({ error: "Translation not configured" }, { status: 503 });
  }

  if (target === "ko" || texts.length === 0) {
    return NextResponse.json({ translations: texts });
  }

  const targetLang = target === "zh" ? "zh-CN" : target;
  const supabase = await cacheClient();

  // 1. Check DB cache first
  const results: string[] = new Array(texts.length).fill("");
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  const { data: cached } = await supabase
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

  // 2. Translate only uncached texts via Google API
  if (uncachedTexts.length > 0) {
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

      if (data.data?.translations) {
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

        // 3. Save to DB cache (best effort)
        if (rowsToInsert.length > 0) {
          try {
            await supabase.from("translations").upsert(rowsToInsert, { onConflict: "source_text,target_lang" });
          } catch {
            // 캐시 저장 실패는 무시
          }
        }
      } else {
        return NextResponse.json({ translations: texts });
      }
    } catch {
      return NextResponse.json({ translations: texts });
    }
  }

  return NextResponse.json({ translations: results });
}

import { NextRequest, NextResponse } from "next/server";

const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

// Simple in-memory cache to avoid repeated API calls
const cache = new Map<string, string>();

export async function POST(req: NextRequest) {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    return NextResponse.json({ error: "Translation not configured" }, { status: 503 });
  }

  const { texts, target } = await req.json();

  if (!texts || !target || !Array.isArray(texts)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Skip if target is Korean (source language)
  if (target === "ko") {
    return NextResponse.json({ translations: texts });
  }

  const targetLang = target === "zh" ? "zh-CN" : target;

  // Check cache first
  const results: string[] = [];
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const key = `${texts[i]}::${targetLang}`;
    const cached = cache.get(key);
    if (cached) {
      results[i] = cached;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]);
      results[i] = ""; // placeholder
    }
  }

  // Translate uncached texts
  if (uncachedTexts.length > 0) {
    try {
      const params = new URLSearchParams({
        key: GOOGLE_TRANSLATE_API_KEY,
        target: targetLang,
        source: "ko",
        format: "text",
      });
      uncachedTexts.forEach((t) => params.append("q", t));

      const res = await fetch(
        `https://translation.googleapis.com/language/translate/v2?${params.toString()}`,
        { method: "POST" }
      );

      const data = await res.json();

      if (data.data?.translations) {
        data.data.translations.forEach((t: { translatedText: string }, idx: number) => {
          const originalIdx = uncachedIndices[idx];
          const translated = t.translatedText;
          results[originalIdx] = translated;
          // Cache it
          cache.set(`${uncachedTexts[idx]}::${targetLang}`, translated);
        });
      }
    } catch {
      // On error, return original texts
      return NextResponse.json({ translations: texts });
    }
  }

  return NextResponse.json({ translations: results });
}

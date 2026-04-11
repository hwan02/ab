import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

export async function POST(req: NextRequest) {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    return NextResponse.json({ error: "Translation not configured" }, { status: 503 });
  }

  const { texts, target } = await req.json();

  if (!texts || !target || !Array.isArray(texts)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (target === "ko") {
    return NextResponse.json({ translations: texts });
  }

  const targetLang = target === "zh" ? "zh-CN" : target;
  const supabase = await createClient();

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

      const res = await fetch(
        `https://translation.googleapis.com/language/translate/v2?${params.toString()}`,
        { method: "POST" }
      );

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

        // 3. Save to DB cache (fire and forget)
        if (rowsToInsert.length > 0) {
          await supabase
            .from("translations")
            .upsert(rowsToInsert, { onConflict: "source_text,target_lang" });
        }
      }
    } catch {
      return NextResponse.json({ translations: texts });
    }
  }

  return NextResponse.json({ translations: results });
}

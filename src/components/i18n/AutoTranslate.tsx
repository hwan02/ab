"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";

interface AutoTranslateProps {
  text: string;
  className?: string;
}

// Batch queue for translation requests
let batchQueue: { text: string; target: string; resolve: (v: string) => void }[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

function flushBatch() {
  const queue = [...batchQueue];
  batchQueue = [];
  batchTimer = null;

  if (queue.length === 0) return;

  const target = queue[0].target;
  const texts = queue.map((q) => q.text);

  fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, target }),
  })
    .then((r) => r.json())
    .then((data) => {
      const translations: string[] = data.translations ?? texts;
      queue.forEach((q, i) => q.resolve(translations[i] ?? q.text));
    })
    .catch(() => {
      queue.forEach((q) => q.resolve(q.text));
    });
}

function requestTranslation(text: string, target: string): Promise<string> {
  return new Promise((resolve) => {
    batchQueue.push({ text, target, resolve });
    if (!batchTimer) {
      batchTimer = setTimeout(flushBatch, 50);
    }
  });
}

// Client-side cache
const clientCache = new Map<string, string>();

export default function AutoTranslate({ text, className }: AutoTranslateProps) {
  const { locale } = useI18n();
  const [translated, setTranslated] = useState(text);

  useEffect(() => {
    if (locale === "ko" || !text) {
      setTranslated(text);
      return;
    }

    const cacheKey = `${text}::${locale}`;
    const cached = clientCache.get(cacheKey);
    if (cached) {
      setTranslated(cached);
      return;
    }

    requestTranslation(text, locale).then((result) => {
      clientCache.set(cacheKey, result);
      setTranslated(result);
    });
  }, [text, locale]);

  return <span className={className}>{translated}</span>;
}

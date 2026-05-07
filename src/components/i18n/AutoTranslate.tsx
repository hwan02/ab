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

const CACHE_KEY = "at-cache";
const CACHE_VERSION = 1;

// Persistent localStorage cache
let memCache: Map<string, string> | null = null;

function getCache(): Map<string, string> {
  if (memCache) return memCache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.v === CACHE_VERSION && parsed.d) {
        memCache = new Map(Object.entries(parsed.d));
        return memCache;
      }
    }
  } catch {}
  memCache = new Map();
  return memCache;
}

function saveCache() {
  try {
    const cache = getCache();
    // Limit cache size to 2000 entries
    if (cache.size > 2000) {
      const entries = [...cache.entries()];
      memCache = new Map(entries.slice(entries.length - 1500));
    }
    const obj: Record<string, string> = {};
    getCache().forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(CACHE_KEY, JSON.stringify({ v: CACHE_VERSION, d: obj }));
  } catch {}
}

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
      const cache = getCache();
      queue.forEach((q, i) => {
        const result = translations[i] ?? q.text;
        cache.set(`${q.text}::${q.target}`, result);
        q.resolve(result);
      });
      saveCache();
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

export default function AutoTranslate({ text, className }: AutoTranslateProps) {
  const { locale } = useI18n();
  const [translated, setTranslated] = useState(text);

  useEffect(() => {
    if (locale === "ko" || !text) {
      setTranslated(text);
      return;
    }

    const cacheKey = `${text}::${locale}`;
    const cached = getCache().get(cacheKey);
    if (cached) {
      setTranslated(cached);
      return;
    }

    requestTranslation(text, locale).then((result) => {
      setTranslated(result);
    });
  }, [text, locale]);

  return <span className={className}>{translated}</span>;
}

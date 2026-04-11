"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import AutoTranslate from "@/components/i18n/AutoTranslate";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { Faq } from "@/types/database";

const DEFAULT_FAQ_ITEMS: { q: TranslationKey; a: TranslationKey }[] = [
  { q: "faq.q1", a: "faq.a1" },
  { q: "faq.q2", a: "faq.a2" },
  { q: "faq.q3", a: "faq.a3" },
  { q: "faq.q4", a: "faq.a4" },
  { q: "faq.q5", a: "faq.a5" },
];

interface FaqContentProps {
  customFaqs?: Faq[];
}

export default function FaqContent({ customFaqs }: FaqContentProps) {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Merge: custom DB FAQs first, then defaults
  const allItems: { question: string; answer: string; isCustom: boolean }[] = [
    ...(customFaqs ?? []).map((f) => ({ question: f.question, answer: f.answer, isCustom: true })),
    ...DEFAULT_FAQ_ITEMS.map((item) => ({ question: t(item.q), answer: t(item.a), isCustom: false })),
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("faq.title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("faq.subtitle")}</p>
      </div>

      <div className="space-y-3">
        {allItems.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50"
              >
                <span className="pr-4 text-sm font-semibold text-gray-900">
                  {item.isCustom ? <AutoTranslate text={item.question} /> : item.question}
                </span>
                <svg
                  className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {isOpen && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <p className="text-sm leading-relaxed text-gray-600">
                    {item.isCustom ? <AutoTranslate text={item.answer} /> : item.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

"use client";

import AutoTranslate from "@/components/i18n/AutoTranslate";

export default function TranslatedDescription({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-xl bg-white p-4 border border-gray-200">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
        <AutoTranslate text={text} />
      </p>
    </div>
  );
}

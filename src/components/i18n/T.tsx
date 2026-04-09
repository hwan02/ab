"use client";

import { useI18n } from "@/lib/i18n/context";
import type { TranslationKey } from "@/lib/i18n/translations";

export function T({ k }: { k: TranslationKey }) {
  const { t } = useI18n();
  return <>{t(k)}</>;
}

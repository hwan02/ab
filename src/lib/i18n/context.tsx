"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { type Locale, t as translate, type TranslationKey } from "./translations";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "ko",
  setLocale: () => {},
  t: (key) => translate(key, "ko"),
});

const STORAGE_KEY = "gc-locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && ["ko", "en", "ja", "zh"].includes(saved)) {
      setLocaleState(saved);
    }
    setMounted(true);
  }, []);

  // Sync <html lang> with current locale so native inputs (date, time) use the correct format
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  };

  const t = (key: TranslationKey) => translate(key, locale);

  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

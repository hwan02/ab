"use client";

import { useLayoutEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/context";

/** I18nProvider 가 쓰는 localStorage 키와 같아야 한다. */
const STORAGE_KEY = "gc-locale";

/**
 * 호스트 화면(/host…) 한국어 고정.
 *
 * `active` 인 동안 표시 locale 을 ko 로 바꾸되
 * - 게스트가 고른 언어(localStorage 의 gc-locale)는 덮어쓰지 않고 그대로 보존하고,
 * - 화면을 벗어나면(언마운트) 원래 locale 로 되돌린다.
 *
 * useLayoutEffect 라 저장된 언어가 en/ja/zh 여도 첫 페인트 전에 ko 로 바뀐다.
 * I18nProvider 의 setLocale 은 값을 저장까지 하므로, 호출 직후 저장값을 원래대로 돌려 놓는다.
 */
export function useHostLocale(active: boolean) {
  const { locale, setLocale } = useI18n();

  // 효과 안에서 최신 locale/setLocale 을 읽기 위한 ref (렌더 중에는 쓰지 않는다)
  const latest = useRef({ locale, setLocale });
  useLayoutEffect(() => {
    latest.current = { locale, setLocale };
  });

  useLayoutEffect(() => {
    if (!active) return;
    const { locale: prevLocale, setLocale: apply } = latest.current;
    if (prevLocale === "ko") return;

    const saved = readSaved();
    apply("ko");
    writeSaved(saved); // setLocale 이 ko 를 저장했으므로 게스트 선택값으로 되돌린다

    return () => {
      apply(prevLocale);
      if (!saved) writeSaved(null); // 원래 저장값이 없었다면 다시 브라우저 언어 자동감지로
    };
  }, [active]);
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSaved(value: string | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage 를 못 쓰는 환경(프라이빗 모드 등)은 무시
  }
}

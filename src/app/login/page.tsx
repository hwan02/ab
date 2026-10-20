"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHostLocale } from "@/components/layout/useHostLocale";
import { PRODUCT_NAME } from "@/lib/airbnb/brand";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  useHostLocale(true); // 로그인 화면은 한국어 고정, 언어 선택 없음

  const handleGoogleLogin = async () => {
    setLoading(true);
    const supabase = createClient();
    const origin = window.location.origin;

    // 로그인 뒤 돌아갈 곳(?next=). 같은 사이트 경로만 콜백에 전달하고, 최종 검증은 콜백이 한다. 기본은 내 숙소.
    const next = new URLSearchParams(window.location.search).get("next") ?? "/host";
    const callback = new URL("/auth/callback", origin);
    if (next.startsWith("/") && !next.startsWith("//")) {
      callback.searchParams.set("next", next);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });

    if (error) {
      console.error("Login error:", error.message);
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-rose-50 via-white to-orange-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-rose-200/30 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-orange-200/30 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="rounded-3xl bg-white/80 p-8 shadow-xl shadow-gray-200/50 ring-1 ring-gray-100 backdrop-blur-md">
          <div className="mb-8 text-center">
            <img src="/popo.png" alt={PRODUCT_NAME} className="mx-auto mb-5 h-24 w-24 object-contain" />
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">{PRODUCT_NAME}</h1>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              에어비앤비 게스트 메시지에 자동으로 답장합니다.
              <br />
              숙소 정보와 답변 규칙만 등록하면 끝.
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {loading ? "로그인 중..." : "Google로 시작하기"}
          </button>

          <ol className="mt-6 space-y-2 text-xs text-gray-500">
            <li className="flex gap-2"><span className="font-semibold text-rose-500">1</span>숙소 정보 등록 (와이파이, 체크인 시간 등)</li>
            <li className="flex gap-2"><span className="font-semibold text-rose-500">2</span>자주 받는 질문의 키워드와 답변 등록</li>
            <li className="flex gap-2"><span className="font-semibold text-rose-500">3</span>에어비앤비 숙소에 포포톡 공동호스트 추가</li>
          </ol>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          {PRODUCT_NAME} &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

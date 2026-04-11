"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { LOCALES } from "@/lib/i18n/translations";

export default function LandingPage() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  const handleEnter = () => {
    document.cookie = "entered=1; path=/; max-age=86400";
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Full-screen hero */}
      <div className="relative flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-rose-50 to-gray-50 px-6 text-center">
        {/* Language switcher */}
        <div className="absolute right-4 top-4">
          <div className="flex items-center gap-0.5 rounded-full bg-white/80 p-1 shadow-sm backdrop-blur-sm">
            {LOCALES.map((loc) => (
              <button
                key={loc.code}
                onClick={() => setLocale(loc.code)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                  locale === loc.code
                    ? "bg-rose-500 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {loc.flag}
              </button>
            ))}
          </div>
        </div>

        <img
          src="/podong.png"
          alt="포동이"
          className="mb-6 h-52 w-52 object-contain drop-shadow-lg"
        />
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          {t("login.title")}
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-gray-500">
          {t("landing.subtitle")}
        </p>

        <button
          onClick={handleEnter}
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-rose-200/50 transition-all hover:bg-rose-600 hover:shadow-xl"
        >
          {t("landing.enter")}
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        <footer className="absolute bottom-6 text-xs text-gray-400">
          {t("login.title")} &copy; {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}

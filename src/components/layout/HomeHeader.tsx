"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import { LOCALES } from "@/lib/i18n/translations";

interface HomeHeaderProps {
  userName: string | null;
  avatarUrl: string | null;
  isAdmin?: boolean;
}

export default function HomeHeader({ userName, avatarUrl, isAdmin }: HomeHeaderProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-bold text-rose-500">
          popo's stay
        </Link>
        <div className="flex items-center gap-2">
          {/* Language switcher (compact) */}
          <div className="hidden items-center gap-0.5 rounded-full border border-gray-200 p-0.5 sm:flex">
            {LOCALES.map((loc) => (
              <button
                key={loc.code}
                onClick={() => setLocale(loc.code)}
                className={`rounded-full px-2 py-1 text-xs font-medium transition-all ${
                  locale === loc.code
                    ? "bg-rose-500 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {loc.flag}
              </button>
            ))}
          </div>

          {/* Avatar dropdown */}
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-gray-100"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={userName ?? ""}
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-gray-100"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-orange-400 text-sm font-semibold text-white">
                  {(userName ?? "G").charAt(0).toUpperCase()}
                </div>
              )}
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                {userName && (
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">{userName}</p>
                  </div>
                )}

                {/* Mobile language switcher inside dropdown */}
                <div className="border-b border-gray-100 px-4 py-2 sm:hidden">
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
                    {t("login.language")}
                  </p>
                  <div className="flex gap-1">
                    {LOCALES.map((loc) => (
                      <button
                        key={loc.code}
                        onClick={() => setLocale(loc.code)}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition-all ${
                          locale === loc.code
                            ? "bg-rose-500 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {loc.flag}
                      </button>
                    ))}
                  </div>
                </div>

                {isAdmin && (
                  <Link
                    href="/host"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                    </svg>
                    {t("home.hostMode")}
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                  </svg>
                  {t("common.logout")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

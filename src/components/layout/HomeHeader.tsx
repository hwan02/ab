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
  const [emailNotif, setEmailNotif] = useState(false);
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

  // Load email notification preference
  useEffect(() => {
    const loadNotif = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("email_notifications").eq("id", user.id).single();
      if (data) setEmailNotif(data.email_notifications ?? false);
    };
    loadNotif();
  }, []);

  const toggleEmailNotif = async () => {
    const newVal = !emailNotif;
    setEmailNotif(newVal);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ email_notifications: newVal }).eq("id", user.id);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-rose-500">
          <img src="/popo.png" alt="popo" className="h-9 w-9 object-contain" />
          {t("login.title")}
        </Link>
        <div className="flex items-center gap-2">
          {/* Global nav links */}
          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              href="/reviews"
              className="group relative rounded-lg bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-100"
            >
              {t("nav.reviews")}
              <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {t("reviews.tooltip")}
              </span>
            </Link>
            <Link
              href="/faq"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              {t("nav.faq")}
            </Link>
          </nav>

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

                {/* Mobile nav links */}
                <div className="border-b border-gray-100 sm:hidden">
                  <Link
                    href="/reviews"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                  >
                    <svg className="h-4 w-4 text-rose-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                    </svg>
                    {t("nav.reviews")}
                    <span className="ml-auto text-[10px] text-rose-400">{t("reviews.tooltip")}</span>
                  </Link>
                  <Link
                    href="/faq"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                    </svg>
                    {t("nav.reviews")}
                  </Link>
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
                {/* Email notification toggle */}
                <div className="border-b border-gray-100 px-4 py-2.5">
                  <button
                    onClick={toggleEmailNotif}
                    className="flex w-full items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                      </svg>
                      <span className="text-sm text-gray-700">{t("settings.emailNotifications")}</span>
                    </div>
                    <div className={`relative h-5 w-9 rounded-full transition-colors ${emailNotif ? "bg-rose-500" : "bg-gray-300"}`}>
                      <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${emailNotif ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                  </button>
                </div>

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

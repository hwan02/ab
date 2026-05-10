"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PropertyNav from "@/components/layout/PropertyNav";
import AnnouncementModal from "@/components/announcements/AnnouncementModal";
import { useI18n } from "@/lib/i18n/context";

interface PropertyLayoutShellProps {
  propertyId: string;
  propertyName: string;
  propertyNameEn?: string | null;
  propertyNameJa?: string | null;
  propertyNameZh?: string | null;
  checkIn: string | null;
  checkOut: string | null;
  isWithinStayPeriod: boolean;
  isLoggedIn?: boolean;
  children: React.ReactNode;
}

export default function PropertyLayoutShell({
  propertyId,
  propertyName,
  propertyNameEn,
  propertyNameJa,
  propertyNameZh,
  checkIn,
  checkOut,
  isWithinStayPeriod,
  isLoggedIn = true,
  children,
}: PropertyLayoutShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale } = useI18n();
  const nameMap: Record<string, string | null | undefined> = { en: propertyNameEn, ja: propertyNameJa, zh: propertyNameZh };
  const displayName = (locale !== "ko" && nameMap[locale]) || propertyName;
  const [showStayModal, setShowStayModal] = useState(false);
  const [blockedPath, setBlockedPath] = useState<string | null>(null);

  const isChatPage = pathname.endsWith("/chat");
  const isConciergePage = pathname.endsWith("/concierge");

  // Intercept navigation to chat/concierge
  const handleNavClick = (href: string) => {
    const isChatOrConcierge = href.endsWith("/chat") || href.endsWith("/concierge");
    if (isChatOrConcierge) {
      if (!isLoggedIn) {
        router.push("/login");
        return true;
      }
      if (!isWithinStayPeriod) {
        setBlockedPath(href);
        setShowStayModal(true);
        return true;
      }
    }
    return false;
  };

  // Chat page: full-screen without chrome
  if (isChatPage) {
    if (!isLoggedIn) {
      router.push("/login");
      return null;
    }
    if (!isWithinStayPeriod) {
      return (
        <StayRequiredModal
          checkIn={checkIn}
          checkOut={checkOut}
          propertyId={propertyId}
          onClose={() => router.back()}
        />
      );
    }
    return <div className="flex h-dvh flex-col">{children}</div>;
  }

  // Concierge page: has its own header, just add nav
  if (isConciergePage) {
    if (!isLoggedIn) {
      router.push("/login");
      return null;
    }
    if (!isWithinStayPeriod) {
      return (
        <StayRequiredModal
          checkIn={checkIn}
          checkOut={checkOut}
          propertyId={propertyId}
          onClose={() => router.back()}
        />
      );
    }
    return (
      <div className="min-h-dvh bg-gray-50 pb-20">
        {children}
        <PropertyNav propertyId={propertyId} onNavClick={handleNavClick} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Home"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="truncate text-lg font-bold text-gray-900">
            {displayName}
          </h1>
        </div>
      </header>

      {/* Page Content */}
      <main className="mx-auto max-w-4xl">{children}</main>

      {/* Bottom Navigation */}
      <PropertyNav propertyId={propertyId} onNavClick={handleNavClick} />

      {/* Announcement Modal */}
      <AnnouncementModal propertyId={propertyId} />

      {/* Stay period required modal */}
      {showStayModal && (
        <StayRequiredModal
          checkIn={checkIn}
          checkOut={checkOut}
          propertyId={propertyId}
          onClose={() => setShowStayModal(false)}
        />
      )}
    </div>
  );
}

const LOCALE_MAP: Record<string, string> = {
  ko: "ko-KR", en: "en-US", ja: "ja-JP", zh: "zh-CN",
};

function StayRequiredModal({
  checkIn,
  checkOut,
  propertyId,
  onClose,
}: {
  checkIn: string | null;
  checkOut: string | null;
  propertyId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const dateLocale = LOCALE_MAP[locale] || "ko-KR";
  const [ciDate, setCiDate] = useState(checkIn ?? "");
  const [coDate, setCoDate] = useState(checkOut ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const hasExistingDates = !!(checkIn || checkOut);

  const handleSubmit = async () => {
    if (!ciDate || !coDate) return;
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("guest_requests").insert({
      property_id: propertyId,
      guest_id: user.id,
      check_in: ciDate,
      check_out: coDate,
    });

    setSubmitting(false);
    setSent(true);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="px-6 py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          </div>

          {sent ? (
            <>
              <h3 className="text-lg font-bold text-gray-900">{t("browse.requestSent")}</h3>
              <p className="mt-2 text-sm text-gray-500">{t("access.stayRequestSentDesc")}</p>
            </>
          ) : hasExistingDates ? (
            <>
              <h3 className="text-lg font-bold text-gray-900">{t("access.stayPeriodRequired")}</h3>
              <p className="mt-2 text-sm text-gray-500">{t("access.stayPeriodDesc")}</p>
              <div className="mt-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                {checkIn && <span>{formatDate(checkIn)}</span>}
                {checkIn && checkOut && <span> ~ </span>}
                {checkOut && <span>{formatDate(checkOut)}</span>}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-gray-900">{t("access.stayDateInput")}</h3>
              <p className="mt-2 text-sm text-gray-500">{t("access.stayDateInputDesc")}</p>
              <div className="mt-4 space-y-3 text-left">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{t("browse.checkIn")}</label>
                  <input
                    type="date"
                    value={ciDate}
                    onChange={(e) => setCiDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{t("browse.checkOut")}</label>
                  <input
                    type="date"
                    value={coDate}
                    onChange={(e) => setCoDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex gap-2 border-t border-gray-100 px-6 py-3">
          <button
            onClick={sent ? () => { onClose(); router.refresh(); } : onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
          >
            {t("common.close")}
          </button>
          {!sent && !hasExistingDates && (
            <button
              onClick={handleSubmit}
              disabled={submitting || !ciDate || !coDate}
              className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-medium text-white transition-all hover:bg-rose-600 disabled:opacity-50"
            >
              {submitting ? "..." : t("access.requestStay")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

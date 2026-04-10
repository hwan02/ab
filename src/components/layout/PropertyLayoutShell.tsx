"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import PropertyNav from "@/components/layout/PropertyNav";
import AnnouncementModal from "@/components/announcements/AnnouncementModal";
import { useI18n } from "@/lib/i18n/context";

interface PropertyLayoutShellProps {
  propertyId: string;
  propertyName: string;
  checkIn: string | null;
  checkOut: string | null;
  isWithinStayPeriod: boolean;
  children: React.ReactNode;
}

export default function PropertyLayoutShell({
  propertyId,
  propertyName,
  checkIn,
  checkOut,
  isWithinStayPeriod,
  children,
}: PropertyLayoutShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [showStayModal, setShowStayModal] = useState(false);
  const [blockedPath, setBlockedPath] = useState<string | null>(null);

  const isChatPage = pathname.endsWith("/chat");
  const isConciergePage = pathname.endsWith("/concierge");

  // Intercept navigation to chat/concierge when outside stay period
  const handleNavClick = (href: string) => {
    const isChatOrConcierge = href.endsWith("/chat") || href.endsWith("/concierge");
    if (isChatOrConcierge && !isWithinStayPeriod) {
      setBlockedPath(href);
      setShowStayModal(true);
      return true; // blocked
    }
    return false;
  };

  // Chat page: full-screen without chrome
  if (isChatPage) {
    if (!isWithinStayPeriod) {
      return (
        <StayRequiredModal
          checkIn={checkIn}
          checkOut={checkOut}
          onClose={() => router.back()}
          t={t}
        />
      );
    }
    return <div className="flex h-dvh flex-col">{children}</div>;
  }

  // Concierge page: has its own header, just add nav
  if (isConciergePage) {
    if (!isWithinStayPeriod) {
      return (
        <StayRequiredModal
          checkIn={checkIn}
          checkOut={checkOut}
          onClose={() => router.back()}
          t={t}
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
            {propertyName}
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
          onClose={() => setShowStayModal(false)}
          t={t}
        />
      )}
    </div>
  );
}

function StayRequiredModal({
  checkIn,
  checkOut,
  onClose,
  t,
}: {
  checkIn: string | null;
  checkOut: string | null;
  onClose: () => void;
  t: (key: Parameters<ReturnType<typeof useI18n>["t"]>[0]) => string;
}) {
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="px-6 py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {t("access.stayPeriodRequired")}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {t("access.stayPeriodDesc")}
          </p>
          {(checkIn || checkOut) && (
            <div className="mt-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {checkIn && <span>{formatDate(checkIn)}</span>}
              {checkIn && checkOut && <span> ~ </span>}
              {checkOut && <span>{formatDate(checkOut)}</span>}
            </div>
          )}
        </div>
        <div className="border-t border-gray-100 px-6 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-rose-500 py-2.5 text-sm font-medium text-white transition-all hover:bg-rose-600"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

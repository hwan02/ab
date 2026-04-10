"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import PropertyNav from "@/components/layout/PropertyNav";
import AnnouncementModal from "@/components/announcements/AnnouncementModal";

interface PropertyLayoutShellProps {
  propertyId: string;
  propertyName: string;
  children: React.ReactNode;
}

export default function PropertyLayoutShell({
  propertyId,
  propertyName,
  children,
}: PropertyLayoutShellProps) {
  const pathname = usePathname();
  const isChatPage = pathname.endsWith("/chat");
  const isConciergePage = pathname.endsWith("/concierge");

  // Chat page: full-screen without chrome
  if (isChatPage) {
    return <div className="flex h-dvh flex-col">{children}</div>;
  }

  // Concierge page: has its own header, just add nav
  if (isConciergePage) {
    return (
      <div className="min-h-dvh bg-gray-50 pb-20">
        {children}
        <PropertyNav propertyId={propertyId} />
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
      <PropertyNav propertyId={propertyId} />

      {/* Announcement Modal */}
      <AnnouncementModal propertyId={propertyId} />
    </div>
  );
}

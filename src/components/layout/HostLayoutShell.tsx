"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface NavItem {
  label: string;
  segment: string;
  icon: ReactNode;
}

interface HostLayoutShellProps {
  propertyId: string;
  propertyName: string;
  navItems: NavItem[];
  children: ReactNode;
}

export default function HostLayoutShell({
  propertyId,
  propertyName,
  navItems,
  children,
}: HostLayoutShellProps) {
  const pathname = usePathname();
  const isChatPage = pathname.endsWith("/chat");

  // Chat page: full-screen without shell
  if (isChatPage) {
    return <div className="flex h-dvh flex-col">{children}</div>;
  }

  const currentSegment = pathname.split("/").pop();

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Breadcrumb header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <Link
            href="/host"
            className="flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5 8.25 12l7.5-7.5"
              />
            </svg>
            내 숙소
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="truncate text-lg font-semibold text-gray-900">
            {propertyName}
          </h1>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = currentSegment === item.segment;
              return (
                <Link
                  key={item.segment}
                  href={`/host/property/${propertyId}/${item.segment}`}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-rose-50 text-rose-600"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-gray-200 bg-white lg:hidden">
          {navItems.map((item) => {
            const isActive = currentSegment === item.segment;
            return (
              <Link
                key={item.segment}
                href={`/host/property/${propertyId}/${item.segment}`}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition-colors ${
                  isActive
                    ? "font-semibold text-rose-500"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Main content */}
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/lib/i18n/context";
import { LOCALES } from "@/lib/i18n/translations";
import { Card } from "@/components/ui/Card";
import type { Property } from "@/types/database";

interface LandingPageProps {
  properties: Property[];
}

export default function LandingPage({ properties }: LandingPageProps) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Hero */}
      <div className="relative flex flex-col items-center justify-center bg-gradient-to-b from-rose-50 to-gray-50 px-6 py-16 text-center">
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
          src="/popo.png"
          alt="popo"
          className="mb-6 h-32 w-32 object-contain drop-shadow-lg"
        />
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          {t("login.title")}
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-gray-500">
          {t("landing.subtitle")}
        </p>

        <Link
          href="/login"
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-rose-200/50 transition-all hover:bg-rose-600 hover:shadow-xl"
        >
          {t("landing.enter")}
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>

      {/* Properties */}
      {properties.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            {t("landing.properties")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {properties.map((property) => (
              <Link key={property.id} href={`/property/${property.id}`}>
                <Card className="overflow-hidden p-0 transition-all hover:shadow-md">
                  <div className="relative aspect-[4/3] w-full bg-gray-100">
                    {property.photos?.[0] ? (
                      <Image
                        src={property.photos[0]}
                        alt={property.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="truncate text-base font-semibold text-gray-900">
                      {property.name}
                    </h3>
                    {property.address && (
                      <p className="mt-1 truncate text-sm text-gray-500">
                        {property.address}
                      </p>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-gray-400">
        {t("login.title")} &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

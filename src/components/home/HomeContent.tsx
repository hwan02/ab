"use client";

import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/lib/i18n/context";
import { lp } from "@/lib/i18n/localize";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Property } from "@/types/database";

interface HomeContentProps {
  isHost: boolean;
  properties: Property[];
}

export default function HomeContent({
  isHost,
  properties,
}: HomeContentProps) {
  const { t } = useI18n();

  return (
    <main className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
      {/* Host Mode Banner */}
      {isHost && (
        <Link
          href="/host"
          className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-5 py-4 text-white shadow-md shadow-rose-200/50 transition-all hover:shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold">{t("home.hostMode")}</p>
              <p className="text-xs text-white/80">
                {t("home.hostModeDesc")}
              </p>
            </div>
          </div>
          <svg className="h-5 w-5 text-white/80" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      )}

      {/* All Properties */}
      <section className="mt-6">
        {properties.length === 0 ? (
          <EmptyState
            title={t("home.noProperties")}
            description={t("home.noPropertiesDesc")}
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function PropertyCard({ property }: { property: Property }) {
  const { locale } = useI18n();
  const photoUrl = property.photos?.[0];
  const name = lp(property, "name", locale);
  const address = lp(property, "address", locale);

  return (
    <Link href={`/property/${property.id}`}>
      <Card className="overflow-hidden p-0 transition-all hover:shadow-md">
        <div className="relative aspect-[4/3] w-full bg-gray-100">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={name}
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
            {name}
          </h3>
          {address && (
            <p className="mt-1 truncate text-sm text-gray-500">
              {address}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}

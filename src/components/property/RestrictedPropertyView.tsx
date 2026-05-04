"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import { lp } from "@/lib/i18n/localize";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import PhotoGallery from "@/components/property/PhotoGallery";
import type { Property } from "@/types/database";

interface RestrictedPropertyViewProps {
  property: Property;
  hasPendingRequest: boolean;
  isExpired?: boolean;
}

function getApproximateLocation(address: string | null): string | null {
  if (!address) return null;
  // Show only the last 2 parts of the address (e.g. city, country)
  const parts = address.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 2) return address;
  return parts.slice(-2).join(", ");
}

export default function RestrictedPropertyView({
  property,
  hasPendingRequest,
  isExpired = false,
}: RestrictedPropertyViewProps) {
  const { t, locale } = useI18n();
  const supabase = createClient();
  const name = lp(property, "name", locale);
  const description = lp(property, "description", locale);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(hasPendingRequest);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const address = lp(property, "address", locale);
  const approximateLocation = getApproximateLocation(address);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError(t("common.loginRequired"));
      setIsSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("guest_requests")
      .insert({
        property_id: property.id,
        guest_id: user.id,
        check_in: checkIn || null,
        check_out: checkOut || null,
        message: message || null,
      });

    if (insertError) {
      setError(t("browse.requestFailed"));
      setIsSubmitting(false);
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      await fetch("/api/notify/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: profile?.name || user.email,
          messageType: "guest_request",
          content: JSON.stringify({
            checkIn: checkIn || "-",
            checkOut: checkOut || "-",
          }),
          propertyName: property.name,
        }),
      });
    } catch {
      // Slack failure is non-critical
    }

    setSuccess(true);
    setIsPending(true);
    setIsSubmitting(false);
  }

  return (
    <div className="min-h-dvh bg-gray-50">
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
            {name}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4">
        {/* Photo Gallery */}
        <PhotoGallery photos={property.photos ?? []} />

        {/* Property Name & Approximate Location */}
        <div className="mt-4">
          <h2 className="text-xl font-bold text-gray-900">{name}</h2>
          {approximateLocation && (
            <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                />
              </svg>
              {approximateLocation}
              <span className="ml-1 text-xs text-gray-400">
                ({t("access.approximateLocation")})
              </span>
            </p>
          )}
        </div>

        {/* Description */}
        {description && (
          <div className="mt-4 rounded-xl bg-white p-4 border border-gray-200">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
              {description}
            </p>
          </div>
        )}

        {/* Approval Status Banner */}
        <div className="mt-6 rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800">
                {isExpired ? t("access.expired") : t("access.restricted")}
              </h3>
              <p className="mt-1 text-sm text-amber-700">
                {isExpired ? t("access.expiredDesc") : t("access.restrictedDesc")}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="mt-4">
            {isPending || success ? (
              <div className="flex items-center gap-2 rounded-xl bg-white/60 px-4 py-3">
                <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-sm font-medium text-amber-700">
                  {t("access.requestSent")}
                </span>
              </div>
            ) : (
              <div>
                <p className="mb-3 text-sm text-amber-600">
                  {t("access.requestNotSent")}
                </p>
                {!showForm ? (
                  <Button
                    onClick={() => setShowForm(true)}
                    size="sm"
                    className="w-full"
                  >
                    {t("access.requestStay")}
                  </Button>
                ) : (
                  <div className="space-y-3 rounded-xl bg-white/60 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label={t("browse.checkIn")}
                        type="date"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                      />
                      <Input
                        label={t("browse.checkOut")}
                        type="date"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        {t("browse.message")}
                      </label>
                      <textarea
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                        rows={2}
                        placeholder={t("browse.messagePlaceholder")}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                    </div>
                    {error && (
                      <p className="text-sm text-red-600">{error}</p>
                    )}
                    <Button
                      onClick={handleSubmit}
                      loading={isSubmitting}
                      className="w-full"
                    >
                      {t("access.requestStay")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Restricted features hint */}
        <div className="mt-4 space-y-2">
          {[
            { icon: "M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z", label: t("nav.nearby") },
            { icon: "M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0", label: t("nav.concierge") },
            { icon: "M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z", label: t("nav.chat") },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 opacity-50"
            >
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span className="flex-1 text-sm text-gray-400">{item.label}</span>
              <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

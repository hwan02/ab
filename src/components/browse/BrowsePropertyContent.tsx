"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import PhotoGallery from "@/components/property/PhotoGallery";
import type { Property } from "@/types/database";

interface BrowsePropertyContentProps {
  property: Pick<Property, "id" | "name" | "address" | "description" | "photos">;
  hasPendingRequest: boolean;
}

export default function BrowsePropertyContent({
  property,
  hasPendingRequest,
}: BrowsePropertyContentProps) {
  const { t } = useI18n();
  const supabase = createClient();

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(hasPendingRequest);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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

    // Slack notification
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
    <>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="truncate text-lg font-semibold text-gray-900">
            {property.name}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-8 pt-4">
        {/* Photo Gallery */}
        <PhotoGallery photos={property.photos ?? []} />

        {/* Property Info */}
        <div className="mt-6">
          <h2 className="text-xl font-bold text-gray-900">{property.name}</h2>
          {property.address && (
            <p className="mt-1 text-sm text-gray-500">{property.address}</p>
          )}
          {property.description && (
            <p className="mt-3 whitespace-pre-wrap text-gray-700">
              {property.description}
            </p>
          )}
        </div>

        {/* Request Form */}
        <Card className="mt-6">
          {success ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <p className="font-medium text-gray-900">{t("browse.requestSent")}</p>
              <p className="text-sm text-gray-500">{t("browse.requestPending")}</p>
            </div>
          ) : isPending ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <p className="font-medium text-gray-900">{t("browse.alreadyRequested")}</p>
              <p className="text-sm text-gray-500">{t("browse.requestPending")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  rows={3}
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
                size="lg"
                className="w-full"
              >
                {t("browse.requestStay")}
              </Button>
            </div>
          )}
        </Card>
      </main>
    </>
  );
}

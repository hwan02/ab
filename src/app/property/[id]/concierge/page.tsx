"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ItemRequestForm } from "@/components/chat/ItemRequestForm";
import { ReservationRequestForm } from "@/components/chat/ReservationRequestForm";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useI18n } from "@/lib/i18n/context";

type ActiveForm = "item" | "reservation" | null;

export default function ConciergePage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;
  const { t } = useI18n();

  const [userId, setUserId] = useState<string | null>(null);
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [successMessage, setSuccessMessage] = useState(false);

  const initChatRoom = useCallback(async () => {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setUserId(user.id);

    const { data: existingRoom } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("property_id", propertyId)
      .eq("guest_id", user.id)
      .single();

    if (existingRoom) {
      setChatRoomId(existingRoom.id);
    } else {
      const { data: newRoom } = await supabase
        .from("chat_rooms")
        .insert({
          property_id: propertyId,
          guest_id: user.id,
        })
        .select("id")
        .single();

      if (newRoom) {
        setChatRoomId(newRoom.id);
      }
    }

    setLoading(false);
  }, [propertyId, router]);

  useEffect(() => {
    initChatRoom();
  }, [initChatRoom]);

  const handleSent = () => {
    setActiveForm(null);
    setSuccessMessage(true);
    setTimeout(() => setSuccessMessage(false), 3000);
  };

  const services = [
    {
      id: "item" as const,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
        </svg>
      ),
      title: t("concierge.itemTitle"),
      description: t("concierge.itemDesc"),
      color: "bg-amber-50 border-amber-200",
      iconColor: "text-amber-600 bg-amber-100",
      hoverBorder: "hover:border-amber-400",
    },
    {
      id: "reservation" as const,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75-1.5.75a3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0L3 16.5m15-3.379a48.474 48.474 0 0 0-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 0 1 3 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 0 1 6 13.12M12.265 3.11a.375.375 0 1 1-.53 0L12 2.845l.265.265Z" />
        </svg>
      ),
      title: t("concierge.reservationTitle"),
      description: t("concierge.reservationDesc"),
      color: "bg-rose-50 border-rose-200",
      iconColor: "text-rose-600 bg-rose-100",
      hoverBorder: "hover:border-rose-400",
    },
  ] as const;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <button
            onClick={() => router.back()}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Go back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">
            {t("concierge.title")}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Success Toast */}
        {successMessage && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 shadow-sm">
            <svg className="h-5 w-5 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            {t("concierge.requestSent")}
          </div>
        )}

        {/* Intro */}
        <div className="mb-6">
          <p className="text-sm leading-relaxed text-gray-500">
            {t("concierge.selectService")}
          </p>
        </div>

        {/* Service Cards */}
        <div className="flex flex-col gap-3">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => setActiveForm(service.id)}
              className={`group w-full rounded-2xl border-2 p-5 text-left transition-all ${service.color} ${service.hoverBorder} hover:shadow-md active:scale-[0.98]`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${service.iconColor}`}
                >
                  {service.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900">
                    {service.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {service.description}
                  </p>
                </div>
                <svg
                  className="mt-1 h-5 w-5 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Item Request Form Section */}
        {activeForm === "item" && chatRoomId && userId && (
          <div className="mt-6">
            <Card className="overflow-hidden border-amber-200">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">
                  {t("concierge.itemTitle")}
                </h3>
                <button
                  onClick={() => setActiveForm(null)}
                  className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Close form"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <ItemRequestForm
                chatRoomId={chatRoomId}
                senderId={userId}
                onSent={handleSent}
              />
            </Card>
          </div>
        )}

        {/* Reservation Request Form Section */}
        {activeForm === "reservation" && chatRoomId && userId && (
          <div className="mt-6">
            <Card className="overflow-hidden border-rose-200">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">
                  {t("concierge.reservationTitle")}
                </h3>
                <button
                  onClick={() => setActiveForm(null)}
                  className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Close form"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <ReservationRequestForm
                chatRoomId={chatRoomId}
                senderId={userId}
                onSent={handleSent}
              />
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

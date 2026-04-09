"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import type { ChatRoom as ChatRoomType } from "@/types/database";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function GuestChatPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const propertyId = params.id as string;

  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initChat() {
      const supabase = createClient();

      // Get the current user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError(t("common.loginRequired"));
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      // Try to find an existing chat room for this property and guest
      const { data: existingRooms, error: fetchError } = await supabase
        .from("chat_rooms")
        .select("*")
        .eq("property_id", propertyId)
        .eq("guest_id", user.id)
        .limit(1);

      if (fetchError) {
        setError(t("chat.loadFailed"));
        setLoading(false);
        return;
      }

      if (existingRooms && existingRooms.length > 0) {
        setChatRoomId(existingRooms[0].id);
        setLoading(false);
        return;
      }

      // No existing room found -- create one
      const { data: newRoom, error: createError } = await supabase
        .from("chat_rooms")
        .insert({
          property_id: propertyId,
          guest_id: user.id,
        })
        .select()
        .single();

      if (createError || !newRoom) {
        setError(t("chat.createFailed"));
        setLoading(false);
        return;
      }

      setChatRoomId(newRoom.id);
      setLoading(false);
    }

    initChat();
  }, [propertyId, t]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-gray-500">{t("chat.preparingRoom")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-sm font-medium text-rose-500 hover:text-rose-600"
          >
            {t("common.back")}
          </button>
        </div>
      </div>
    );
  }

  if (!chatRoomId || !currentUserId) {
    return null;
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <header className="flex items-center border-b border-gray-200 bg-white px-4 py-3">
        <button
          onClick={() => router.back()}
          className="mr-3 text-gray-500 hover:text-gray-700"
          aria-label={t("common.back")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{t("chat.hostChat")}</h1>
      </header>

      {/* Chat room */}
      <div className="flex-1 overflow-hidden">
        <ChatRoom chatRoomId={chatRoomId} currentUserId={currentUserId} />
      </div>
    </div>
  );
}

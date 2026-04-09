"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ChatRoom as ChatRoomType, Profile, Message } from "@/types/database";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/context";

interface GuestChatRoom extends ChatRoomType {
  profiles: Pick<Profile, "id" | "name" | "email" | "avatar_url"> | null;
  lastMessage: Message | null;
  unreadCount: number;
}

const LOCALE_MAP: Record<string, string> = {
  ko: "ko-KR",
  en: "en-US",
  ja: "ja-JP",
  zh: "zh-CN",
};

export default function HostChatPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useI18n();
  const dateLocale = LOCALE_MAP[locale] || "ko-KR";
  const propertyId = params.id as string;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [chatRooms, setChatRooms] = useState<GuestChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const loadChatRooms = useCallback(async () => {
    // Get the current user (host)
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

    // Fetch all chat rooms for this property with guest profiles
    const { data, error: fetchError } = await supabase
      .from("chat_rooms")
      .select(
        `
        *,
        profiles:guest_id (
          id,
          name,
          email,
          avatar_url
        )
      `
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(t("chat.loadListFailed"));
      setLoading(false);
      return;
    }

    const rawRooms = (data || []) as (ChatRoomType & {
      profiles: Pick<Profile, "id" | "name" | "email" | "avatar_url"> | null;
    })[];

    // Fetch last message and unread count for each room
    const enrichedRooms: GuestChatRoom[] = await Promise.all(
      rawRooms.map(async (room) => {
        // Get last message
        const { data: lastMsgData } = await supabase
          .from("messages")
          .select("*")
          .eq("chat_room_id", room.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Count unread messages (messages after host_last_read_at)
        let unreadCount = 0;
        if (room.host_last_read_at) {
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("chat_room_id", room.id)
            .neq("sender_id", user.id)
            .gt("created_at", room.host_last_read_at);
          unreadCount = count || 0;
        }

        return {
          ...room,
          lastMessage: (lastMsgData as Message) || null,
          unreadCount,
        };
      })
    );

    // Sort by last message time (most recent first)
    enrichedRooms.sort((a, b) => {
      const aTime = a.lastMessage?.created_at || a.created_at;
      const bTime = b.lastMessage?.created_at || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    setChatRooms(enrichedRooms);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    loadChatRooms();
  }, [loadChatRooms]);

  const handleNewMessage = useCallback(() => {
    // Refresh sidebar data when new message arrives
    loadChatRooms();
  }, [loadChatRooms]);

  const handleSelectRoom = (roomId: string) => {
    setSelectedRoomId(roomId);
  };

  const handleBackToList = () => {
    setSelectedRoomId(null);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-gray-500">{t("chat.loadingList")}</p>
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

  if (!currentUserId) {
    return null;
  }

  const selectedRoom = chatRooms.find((r) => r.id === selectedRoomId);

  function getGuestDisplayName(room: GuestChatRoom): string {
    if (room.profiles?.name) return room.profiles.name;
    if (room.profiles?.email) return room.profiles.email;
    return t("chat.guest");
  }

  function getGuestInitial(room: GuestChatRoom): string {
    const name = getGuestDisplayName(room);
    return name.charAt(0).toUpperCase();
  }

  function getLastMessagePreview(room: GuestChatRoom): string {
    if (!room.lastMessage) return t("chat.startConversation");
    if (room.lastMessage.message_type === "item_request") return `📦 ${t("chat.itemRequestBtn")}`;
    if (room.lastMessage.message_type === "reservation_request") return `🍽️ ${t("chat.reservationRequestBtn")}`;
    return room.lastMessage.content.length > 30
      ? room.lastMessage.content.slice(0, 30) + "..."
      : room.lastMessage.content;
  }

  function getLastMessageTime(room: GuestChatRoom): string {
    const dateStr = room.lastMessage?.created_at || room.created_at;
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return t("chat.yesterday");
    }

    return date.toLocaleDateString(dateLocale, { month: "short", day: "numeric" });
  }

  // Guest list sidebar component
  const guestList = (
    <div className="h-full overflow-y-auto bg-gray-50">
      {chatRooms.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title={t("chat.noRooms")}
            description={t("chat.noRoomsDesc")}
          />
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {chatRooms.map((room) => {
            const isSelected = room.id === selectedRoomId;
            return (
              <li key={room.id}>
                <button
                  onClick={() => handleSelectRoom(room.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-100 ${
                    isSelected ? "bg-white shadow-sm" : ""
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {room.profiles?.avatar_url ? (
                      <img
                        src={room.profiles.avatar_url}
                        alt={getGuestDisplayName(room)}
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-600">
                        {getGuestInitial(room)}
                      </div>
                    )}
                    {/* Unread badge */}
                    {room.unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
                        {room.unreadCount > 99 ? "99+" : room.unreadCount}
                      </span>
                    )}
                  </div>
                  {/* Guest info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`truncate text-sm ${
                          room.unreadCount > 0 ? "font-bold text-gray-900" : "font-medium text-gray-700"
                        }`}
                      >
                        {getGuestDisplayName(room)}
                      </p>
                      <span className="shrink-0 text-[11px] text-gray-400">
                        {getLastMessageTime(room)}
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 truncate text-xs ${
                        room.unreadCount > 0 ? "font-medium text-gray-700" : "text-gray-400"
                      }`}
                    >
                      {getLastMessagePreview(room)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  // Chat area component
  const chatArea = selectedRoomId && currentUserId ? (
    <ChatRoom
      key={selectedRoomId}
      chatRoomId={selectedRoomId}
      currentUserId={currentUserId}
      role="host"
      onNewMessage={handleNewMessage}
    />
  ) : (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-sm text-gray-400">{t("chat.selectGuest")}</p>
    </div>
  );

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
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{t("chat.guestMessages")}</h1>
        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {chatRooms.length}
        </span>
      </header>

      {/* Desktop: split view */}
      <div className="hidden flex-1 overflow-hidden md:flex">
        <aside className="w-80 shrink-0 border-r border-gray-200">{guestList}</aside>
        <main className="flex flex-1 flex-col overflow-hidden">{chatArea}</main>
      </div>

      {/* Mobile: list or chat */}
      <div className="flex flex-1 flex-col overflow-hidden md:hidden">
        {selectedRoomId ? (
          <>
            {/* Mobile chat header with guest info */}
            <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
              <button
                onClick={handleBackToList}
                className="shrink-0 text-gray-500 hover:text-gray-700"
                aria-label={t("common.backToList")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {selectedRoom && (
                <div className="flex items-center gap-2.5">
                  {selectedRoom.profiles?.avatar_url ? (
                    <img
                      src={selectedRoom.profiles.avatar_url}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold text-rose-600">
                      {getGuestInitial(selectedRoom)}
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900">
                    {getGuestDisplayName(selectedRoom)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden">{chatArea}</div>
          </>
        ) : (
          guestList
        )}
      </div>
    </div>
  );
}

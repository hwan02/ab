"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import type { Message } from "@/types/database";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ItemRequestForm } from "@/components/chat/ItemRequestForm";
import { ReservationRequestForm } from "@/components/chat/ReservationRequestForm";
import { MediaUploadButton } from "@/components/chat/MediaUploadButton";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { notifySlack } from "@/lib/notifySlack";

const LOCALE_MAP: Record<string, string> = {
  ko: "ko-KR",
  en: "en-US",
  ja: "ja-JP",
  zh: "zh-CN",
};

interface ChatRoomProps {
  chatRoomId: string;
  currentUserId: string;
  role?: "host" | "guest";
  onNewMessage?: () => void;
}

type ActiveForm = "none" | "item_request" | "reservation_request";

function ChatRoom({ chatRoomId, currentUserId, role = "guest", onNewMessage }: ChatRoomProps) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeForm, setActiveForm] = useState<ActiveForm>("none");
  const [otherTyping, setOtherTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const lastTypingBroadcast = useRef(0);
  const realtimeChannelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const channelIdRef = useRef(0);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  // Update last_read_at when entering or receiving messages
  const updateLastRead = useCallback(async () => {
    const field = role === "host" ? "host_last_read_at" : "guest_last_read_at";
    await supabase
      .from("chat_rooms")
      .update({ [field]: new Date().toISOString() })
      .eq("id", chatRoomId);
  }, [chatRoomId, role, supabase]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch existing messages
  useEffect(() => {
    async function fetchMessages() {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_room_id", chatRoomId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data as Message[]);
      }
      setLoading(false);
      updateLastRead();
    }

    fetchMessages();
  }, [chatRoomId, updateLastRead]);

  // Subscribe to realtime messages + typing in a single channel
  useEffect(() => {
    // Clean up any previous channel before creating a new one
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    channelIdRef.current += 1;
    const currentChannelId = channelIdRef.current;
    const channel = supabase
      .channel(`chat:${chatRoomId}:${currentChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_room_id=eq.${chatRoomId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) {
              return prev;
            }
            return [...prev, newMsg];
          });
          updateLastRead();
          onNewMessage?.();
        }
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId !== currentUserId) {
          setOtherTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000);
        }
      })
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current === channel) {
        realtimeChannelRef.current = null;
      }
      supabase.removeChannel(channel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [chatRoomId, currentUserId, updateLastRead, onNewMessage]);

  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingBroadcast.current < 2000) return;
    if (!realtimeChannelRef.current) return;
    lastTypingBroadcast.current = now;
    realtimeChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId },
    });
  }, [currentUserId]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || sending) return;

    setSending(true);
    setNewMessage("");
    setOtherTyping(false);

    const { error } = await supabase.from("messages").insert({
      chat_room_id: chatRoomId,
      sender_id: currentUserId,
      content,
      message_type: "text",
    });

    if (error) {
      // Restore message on error
      setNewMessage(content);
    } else if (role === "guest") {
      notifySlack({ messageType: "text", content });
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFormSent = () => {
    setActiveForm("none");
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-2 py-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">
              {t("chat.noMessages")}
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const showDate =
              index === 0 ||
              new Date(message.created_at).toDateString() !==
                new Date(messages[index - 1].created_at).toDateString();
            return (
              <div key={message.id}>
                {showDate && (
                  <div className="my-4 flex items-center gap-3 px-4">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="shrink-0 text-xs font-medium text-gray-400">
                      {new Date(message.created_at).toLocaleDateString(
                        LOCALE_MAP[locale] || "ko-KR",
                        { year: "numeric", month: "long", day: "numeric", weekday: "short" }
                      )}
                    </span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                )}
                <MessageBubble
                  message={message}
                  isOwn={message.sender_id === currentUserId}
                />
              </div>
            );
          })
        )}
        {otherTyping && <TypingIndicator label={t("chat.typing")} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Special request forms */}
      {activeForm === "item_request" && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">{t("chat.itemRequest")}</h4>
            <button
              onClick={() => setActiveForm("none")}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              {t("common.close")}
            </button>
          </div>
          <ItemRequestForm
            chatRoomId={chatRoomId}
            senderId={currentUserId}
            onSent={handleFormSent}
          />
        </div>
      )}

      {activeForm === "reservation_request" && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">{t("chat.reservationRequest")}</h4>
            <button
              onClick={() => setActiveForm("none")}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              {t("common.close")}
            </button>
          </div>
          <ReservationRequestForm
            chatRoomId={chatRoomId}
            senderId={currentUserId}
            onSent={handleFormSent}
          />
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white p-3">
        {/* Action buttons row (guest only) */}
        {activeForm === "none" && role === "guest" && (
          <div className="mb-2 flex gap-2">
            <button
              onClick={() => setActiveForm("item_request")}
              className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
            >
              {`📦 ${t("chat.itemRequestBtn")}`}
            </button>
            <button
              onClick={() => setActiveForm("reservation_request")}
              className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
            >
              {`🍽️ ${t("chat.reservationRequestBtn")}`}
            </button>
          </div>
        )}

        {/* Text input row */}
        <div className="flex items-end gap-2">
          <MediaUploadButton
            chatRoomId={chatRoomId}
            senderId={currentUserId}
          />
          <textarea
            value={newMessage}
            onChange={(e) => { setNewMessage(e.target.value); broadcastTyping(); }}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.placeholder")}
            rows={1}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            loading={sending}
            size="md"
            className="shrink-0 rounded-full px-4"
          >
            {t("chat.send")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ChatRoom, type ChatRoomProps };

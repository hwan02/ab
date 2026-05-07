"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/Button";
import type { PodongComment } from "@/types/database";

interface PodongCommentSectionProps {
  photoId: string;
}

export default function PodongCommentSection({ photoId }: PodongCommentSectionProps) {
  const supabase = createClient();
  const { t } = useI18n();
  const [comments, setComments] = useState<PodongComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("id", user.id)
          .single();
        if (profile) {
          setUserName(profile.name);
          setUserAvatar(profile.avatar_url);
        }
      }
    }
    init();
  }, []);

  useEffect(() => {
    fetchComments();

    // Realtime subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase.channel(`podong-comments:${photoId}:${uniqueId}`);

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "podong_comments",
        filter: `photo_id=eq.${photoId}`,
      },
      (payload) => {
        const newMsg = payload.new as PodongComment;
        setComments((prev) => {
          if (prev.some((c) => c.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    );

    channel.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "podong_comments",
        filter: `photo_id=eq.${photoId}`,
      },
      (payload) => {
        const deletedId = (payload.old as { id: string }).id;
        setComments((prev) => prev.filter((c) => c.id !== deletedId));
      }
    );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [photoId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  async function fetchComments() {
    const { data } = await supabase
      .from("podong_comments")
      .select("*")
      .eq("photo_id", photoId)
      .order("created_at", { ascending: true });
    setComments((data as PodongComment[]) ?? []);
  }

  async function handleSubmit() {
    if (!newComment.trim() || !userId) return;

    setSending(true);
    await supabase.from("podong_comments").insert({
      photo_id: photoId,
      user_id: userId,
      user_name: userName,
      user_avatar: userAvatar,
      content: newComment.trim(),
    });
    setNewComment("");
    setSending(false);
  }

  async function handleDelete(commentId: string) {
    if (!confirm(t("podong.commentDeleteConfirm"))) return;
    await supabase.from("podong_comments").delete().eq("id", commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  return (
    <div className="flex flex-col">
      <h3 className="mb-2 text-sm font-semibold text-gray-700">
        {t("podong.comments")} ({comments.length})
      </h3>

      <div className="max-h-48 space-y-3 overflow-y-auto pr-1">
        {comments.length === 0 && (
          <p className="py-4 text-center text-xs text-gray-400">{t("podong.noComments")}</p>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-2">
            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-gray-200">
              {comment.user_avatar ? (
                <img
                  src={comment.user_avatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-gray-800">
                  {comment.user_name || "Guest"}
                </span>
                <span className="text-[10px] text-gray-400">
                  {new Date(comment.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-gray-600">{comment.content}</p>
            </div>
            {userId === comment.user_id && (
              <button
                onClick={() => handleDelete(comment.id)}
                className="shrink-0 self-start rounded p-0.5 text-gray-300 hover:text-red-400"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
        <div ref={commentsEndRef} />
      </div>

      {userId ? (
        <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={t("podong.writeComment")}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm placeholder:text-gray-400 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400/30"
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            loading={sending}
            disabled={!newComment.trim()}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </Button>
        </div>
      ) : (
        <p className="mt-3 border-t border-gray-100 pt-3 text-center text-xs text-gray-400">
          {t("podong.loginToComment")}
        </p>
      )}
    </div>
  );
}

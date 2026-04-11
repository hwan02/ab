"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Review } from "@/types/database";

interface ReviewsContentProps {
  reviews: Review[];
  currentUserId: string | null;
}

export default function ReviewsContent({ reviews, currentUserId }: ReviewsContentProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(5);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    const supabase = createClient();

    let imageUrl: string | null = null;

    // Upload image if selected
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${currentUserId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("property-photos")
        .upload(path, imageFile);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("property-photos")
          .getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from("reviews").insert({
      user_id: currentUserId,
      content: content.trim(),
      rating,
      image_url: imageUrl,
    });
    if (error) {
      alert(t("reviews.writeFailed"));
    } else {
      setContent("");
      setRating(5);
      setImageFile(null);
      setImagePreview(null);
      setShowForm(false);
      router.refresh();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("reviews.deleteConfirm"))) return;
    const supabase = createClient();
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) {
      alert(t("reviews.deleteFailed"));
    } else {
      router.refresh();
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    return `${weeks}w`;
  };

  return (
    <main className="mx-auto max-w-lg px-0 sm:px-4 sm:py-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:border-none sm:bg-transparent sm:px-0 sm:pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t("reviews.title")}</h1>
          <p className="mt-0.5 text-xs text-gray-400">{t("reviews.subtitle")}</p>
        </div>
        {currentUserId && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 rounded-full bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-rose-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t("reviews.write")}
          </button>
        )}
      </div>

      {/* Write form */}
      {showForm && (
        <div className="border-b border-gray-100 bg-white px-4 py-4">
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} onClick={() => setRating(star)} className="transition-transform hover:scale-110">
                <svg className={`h-6 w-6 ${star <= rating ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
          </div>
          {/* Image preview */}
          {imagePreview && (
            <div className="relative mb-3 overflow-hidden rounded-xl">
              <img src={imagePreview} alt="" className="w-full rounded-xl object-cover" style={{ maxHeight: 300 }} />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("reviews.placeholder")}
            rows={3}
            className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
          />
          <div className="mt-3 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
              </svg>
              {t("chat.sendPhoto")}
              <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            </label>
            <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !content.trim()}
              className="rounded-lg bg-rose-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
            >
              {t("reviews.submit")}
            </button>
            </div>
          </div>
        </div>
      )}

      {/* Posts */}
      {reviews.length === 0 ? (
        <div className="px-4 pt-8">
          <EmptyState
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
            }
            title={t("reviews.noReviews")}
            description={t("reviews.noReviewsDesc")}
          />
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {reviews.map((review) => {
            const profile = review.profiles;
            const isOwn = review.user_id === currentUserId;
            return (
              <article key={review.id} className="bg-white">
                {/* Post header */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover ring-2 ring-gray-100"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-orange-400 text-sm font-bold text-white">
                        {(profile?.name ?? t("reviews.anonymous")).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {profile?.name || t("reviews.anonymous")}
                      </p>
                      <p className="text-[11px] text-gray-400">{timeAgo(review.created_at)}</p>
                    </div>
                  </div>
                  {isOwn && (
                    <button
                      onClick={() => handleDelete(review.id)}
                      className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Post image */}
                {review.image_url && (
                  <div className="relative aspect-square w-full bg-gray-100">
                    <Image
                      src={review.image_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 512px) 100vw, 512px"
                    />
                  </div>
                )}

                {/* Stars + content */}
                <div className="px-4 py-3">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        className={`h-4 w-4 ${star <= review.rating ? "text-yellow-400" : "text-gray-200"}`}
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                    <span className="font-semibold">{profile?.name || t("reviews.anonymous")}</span>{" "}
                    {review.content}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

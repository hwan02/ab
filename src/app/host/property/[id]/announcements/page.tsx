"use client";

import { useState, useEffect, use, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import type { Announcement } from "@/types/database";

export default function AnnouncementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: propertyId } = use(params);
  const supabase = createClient();
  const { t } = useI18n();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, [propertyId]);

  async function fetchAnnouncements() {
    setIsFetching(true);
    const { data, error: fetchError } = await supabase
      .from("announcements")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(t("announcements.fetchFailed"));
      console.error("Fetch error:", fetchError);
    } else {
      setAnnouncements((data as Announcement[]) ?? []);
    }
    setIsFetching(false);
  }

  function resetForm() {
    setTitle("");
    setContent("");
    setEditingAnnouncement(null);
    setFormError("");
    setShowForm(false);
  }

  function startEdit(announcement: Announcement) {
    setTitle(announcement.title);
    setContent(announcement.content);
    setEditingAnnouncement(announcement);
    setShowForm(true);
    setFormError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!title.trim()) {
      setFormError(t("announcements.titleRequired"));
      return;
    }
    if (!content.trim()) {
      setFormError(t("announcements.contentRequired"));
      return;
    }

    setIsSubmitting(true);

    if (editingAnnouncement) {
      const { error: updateError } = await supabase
        .from("announcements")
        .update({
          title: title.trim(),
          content: content.trim(),
        })
        .eq("id", editingAnnouncement.id);

      if (updateError) {
        setFormError(t("announcements.updateFailed"));
        console.error("Update error:", updateError);
      } else {
        resetForm();
        await fetchAnnouncements();
      }
    } else {
      const { error: insertError } = await supabase
        .from("announcements")
        .insert({
          property_id: propertyId,
          title: title.trim(),
          content: content.trim(),
        });

      if (insertError) {
        setFormError(t("announcements.createFailed"));
        console.error("Insert error:", insertError);
      } else {
        resetForm();
        await fetchAnnouncements();
      }
    }
    setIsSubmitting(false);
  }

  async function handleDelete(announcementId: string) {
    if (!confirm(t("announcements.deleteConfirm"))) return;

    setDeletingId(announcementId);
    setError("");

    const { error: deleteError } = await supabase
      .from("announcements")
      .delete()
      .eq("id", announcementId);

    if (deleteError) {
      setError(t("announcements.deleteFailed"));
      console.error("Delete error:", deleteError);
    } else {
      setAnnouncements((prev) =>
        prev.filter((a) => a.id !== announcementId)
      );
      if (editingAnnouncement?.id === announcementId) {
        resetForm();
      }
    }
    setDeletingId(null);
  }

  if (isFetching) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("announcements.title")}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("announcements.hostSubtitle")}
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            {t("announcements.write")}
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <Card
          title={editingAnnouncement ? t("announcements.editTitle") : t("announcements.newTitle")}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t("announcements.titleLabel")}
              placeholder={t("announcements.titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
            />

            <Textarea
              label={t("announcements.contentLabel")}
              placeholder={t("announcements.contentPlaceholder")}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              disabled={isSubmitting}
            />

            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={resetForm}
                disabled={isSubmitting}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {editingAnnouncement ? t("common.update") : t("common.register")}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {t("announcements.list")} ({announcements.length})
        </h2>

        {announcements.length === 0 ? (
          <EmptyState
            icon={
              <svg
                className="h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46"
                />
              </svg>
            }
            title={t("announcements.noAnnouncements")}
            description={t("announcements.noAnnouncementsHostDesc")}
            action={
              !showForm ? (
                <Button onClick={() => setShowForm(true)} size="sm">
                  {t("announcements.write")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <Card key={announcement.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-gray-900">
                      {announcement.title}
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                      {announcement.content}
                    </p>
                    <p className="mt-3 text-xs text-gray-400">
                      {formatDate(announcement.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(announcement)}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(announcement.id)}
                      loading={deletingId === announcement.id}
                      className="text-red-500 hover:bg-red-50 hover:text-red-600"
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

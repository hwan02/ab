"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useI18n } from "@/lib/i18n/context";
import { compressImage } from "@/lib/imageCompression";
import type { PropertyGuide } from "@/types/database";

const MAX_VIDEO_SIZE_MB = 50;

type GuideCategory = PropertyGuide["category"];

export default function GuidesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: propertyId } = use(params);
  const supabase = createClient();
  const { t } = useI18n();

  const categories: { key: GuideCategory; label: string }[] = [
    { key: "appliance", label: t("guide.appliance") },
    { key: "directions", label: t("guide.directions") },
    { key: "facility", label: t("guide.facility") },
    { key: "other", label: t("guide.other") },
  ];

  const [guides, setGuides] = useState<PropertyGuide[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [activeCategory, setActiveCategory] = useState<GuideCategory>("appliance");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuide, setEditingGuide] = useState<PropertyGuide | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<GuideCategory>("appliance");
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formPreview, setFormPreview] = useState<string | null>(null);
  const [formMediaType, setFormMediaType] = useState<"image" | "video" | null>(null);

  useEffect(() => {
    fetchGuides();
  }, [propertyId]);

  async function fetchGuides() {
    setIsFetching(true);
    const { data } = await supabase
      .from("property_guides")
      .select("*")
      .eq("property_id", propertyId)
      .order("category", { ascending: true })
      .order("display_order", { ascending: true });
    setGuides((data as PropertyGuide[]) ?? []);
    setIsFetching(false);
  }

  function resetForm() {
    setFormTitle("");
    setFormContent("");
    setFormCategory("appliance");
    setFormFile(null);
    setFormPreview(null);
    setFormMediaType(null);
  }

  function openAddModal() {
    setEditingGuide(null);
    resetForm();
    setFormCategory(activeCategory);
    setIsModalOpen(true);
  }

  function openEditModal(guide: PropertyGuide) {
    setEditingGuide(guide);
    setFormTitle(guide.title);
    setFormContent(guide.content || "");
    setFormCategory(guide.category);
    setFormFile(null);
    setFormPreview(guide.media_url);
    setFormMediaType(guide.media_type);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingGuide(null);
    resetForm();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("video/")) {
      if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
        setError(t("guide.videoTooLarge"));
        return;
      }
      setFormFile(file);
      setFormPreview(URL.createObjectURL(file));
      setFormMediaType("video");
    } else if (file.type.startsWith("image/")) {
      const compressed = await compressImage(file);
      setFormFile(compressed.file);
      setFormPreview(compressed.preview || URL.createObjectURL(compressed.file));
      setFormMediaType("image");
    }
  }

  async function uploadMedia(file: File): Promise<string | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("property-photos")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("property-photos").getPublicUrl(filePath);

    return publicUrl;
  }

  async function handleSubmit() {
    if (!formTitle.trim()) return;

    setIsSubmitting(true);
    setError("");

    let mediaUrl = editingGuide?.media_url || null;
    let mediaType = formMediaType;

    if (formFile) {
      const uploaded = await uploadMedia(formFile);
      if (!uploaded) {
        setError(t("guide.saveFailed"));
        setIsSubmitting(false);
        return;
      }
      mediaUrl = uploaded;
    }

    // If no file and no existing media, clear media fields
    if (!formFile && !formPreview) {
      mediaUrl = null;
      mediaType = null;
    }

    const guideData = {
      property_id: propertyId,
      title: formTitle.trim(),
      content: formContent.trim() || null,
      media_url: mediaUrl,
      media_type: mediaType,
      category: formCategory,
    };

    if (editingGuide) {
      const { error: updateError } = await supabase
        .from("property_guides")
        .update(guideData)
        .eq("id", editingGuide.id);

      if (updateError) {
        setError(t("guide.saveFailed"));
      } else {
        closeModal();
        await fetchGuides();
      }
    } else {
      const maxOrder =
        guides.filter((g) => g.category === formCategory).length > 0
          ? Math.max(
              ...guides
                .filter((g) => g.category === formCategory)
                .map((g) => g.display_order)
            ) + 1
          : 0;

      const { error: insertError } = await supabase.from("property_guides").insert({
        ...guideData,
        display_order: maxOrder,
      });

      if (insertError) {
        setError(t("guide.saveFailed"));
      } else {
        closeModal();
        await fetchGuides();
      }
    }
    setIsSubmitting(false);
  }

  async function handleDelete(guideId: string) {
    if (!confirm(t("guide.deleteConfirm"))) return;

    setDeletingId(guideId);
    setError("");

    const { error: deleteError } = await supabase
      .from("property_guides")
      .delete()
      .eq("id", guideId);

    if (deleteError) {
      setError(t("guide.deleteFailed"));
    } else {
      setGuides((prev) => prev.filter((g) => g.id !== guideId));
    }
    setDeletingId(null);
  }

  const filteredGuides = guides.filter((g) => g.category === activeCategory);

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
          <h1 className="text-2xl font-bold text-gray-900">{t("guide.hostTitle")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("guide.hostSubtitle")}</p>
        </div>
        <Button onClick={openAddModal}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t("guide.addGuide")}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {categories.map((cat) => {
          const count = guides.filter((g) => g.category === cat.key).length;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeCategory === cat.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {cat.label}
              {count > 0 && (
                <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Guide List */}
      {filteredGuides.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          }
          title={t("guide.noGuides")}
          description={t("guide.noGuidesHostDesc")}
          action={
            <Button onClick={openAddModal} size="sm">
              {t("guide.addGuide")}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredGuides.map((guide) => (
            <Card key={guide.id}>
              <div className="flex gap-4">
                {guide.media_url && (
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg">
                    {guide.media_type === "video" ? (
                      <video
                        src={guide.media_url}
                        className="h-full w-full object-cover"
                        muted
                      />
                    ) : (
                      <img
                        src={guide.media_url}
                        alt={guide.title}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-gray-900">{guide.title}</h3>
                  {guide.content && (
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">{guide.content}</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(guide)}>
                  {t("common.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(guide.id)}
                  loading={deletingId === guide.id}
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  {t("common.delete")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingGuide ? t("guide.editGuide") : t("guide.addGuide")}
      >
        <div className="space-y-4">
          <Input
            label={t("guide.guideName")}
            placeholder={t("guide.guideNamePlaceholder")}
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />

          <Textarea
            label={t("guide.description")}
            placeholder={t("guide.descriptionPlaceholder")}
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
          />

          <Select
            label={t("guide.category")}
            value={formCategory}
            onChange={(e) => setFormCategory(e.target.value as GuideCategory)}
            options={categories.map((c) => ({ value: c.key, label: c.label }))}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("guide.media")}
            </label>
            <p className="mb-2 text-xs text-gray-400">{t("guide.mediaHint")}</p>
            <input
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-rose-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-rose-600 hover:file:bg-rose-100"
            />
          </div>

          {formPreview && (
            <div className="relative">
              {formMediaType === "video" ? (
                <video
                  src={formPreview}
                  controls
                  className="h-48 w-full rounded-lg object-contain bg-black"
                />
              ) : (
                <img
                  src={formPreview}
                  alt="Preview"
                  className="h-48 w-full rounded-lg object-contain bg-gray-50"
                />
              )}
              <button
                onClick={() => {
                  setFormFile(null);
                  setFormPreview(null);
                  setFormMediaType(null);
                }}
                className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSubmit} loading={isSubmitting} disabled={!formTitle.trim()}>
              {t("common.save")}
            </Button>
            <Button variant="ghost" onClick={closeModal}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

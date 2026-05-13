"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { compressImage } from "@/lib/imageCompression";
import { extractYouTubeId } from "@/lib/youtube";
import type { CleaningGuide } from "@/types/database";

type Kind = "step" | "supply" | "location";

type PendingPhoto = {
  id: string;
  file: File | null;
  preview: string;
  uploadedUrl: string | null;
};

const KIND_LABELS: Record<Kind, { title: string; addBtn: string; titlePh: string; descPh: string }> = {
  step: {
    title: "청소 순서",
    addBtn: "단계 추가",
    titlePh: "예: 욕실 청소",
    descPh: "청소 방법을 자세히 적어주세요",
  },
  location: {
    title: "보관 위치",
    addBtn: "위치 추가",
    titlePh: "예: 부엌 아래 수납장",
    descPh: "어떤 용품이 어디에 있는지 적어주세요",
  },
  supply: {
    title: "청소용품",
    addBtn: "용품 추가",
    titlePh: "예: 변기 세정제",
    descPh: "사용법 등을 적어주세요",
  },
};

const KIND_ORDER: Kind[] = ["step", "location", "supply"];

export default function CleaningGuideHostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: propertyId } = use(params);
  const supabase = createClient();

  const [guides, setGuides] = useState<CleaningGuide[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [activeKind, setActiveKind] = useState<Kind>("step");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuide, setEditingGuide] = useState<CleaningGuide | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formYoutubeUrl, setFormYoutubeUrl] = useState("");
  const [formYoutubeError, setFormYoutubeError] = useState("");
  const [formKind, setFormKind] = useState<Kind>("step");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareLink(`${window.location.origin}/cleaning/${propertyId}`);
    }
    fetchGuides();
  }, [propertyId]);

  async function fetchGuides() {
    setIsFetching(true);
    const { data } = await supabase
      .from("cleaning_guides")
      .select("*")
      .eq("property_id", propertyId)
      .order("display_order", { ascending: true });
    setGuides((data as CleaningGuide[]) ?? []);
    setIsFetching(false);
  }

  function resetForm() {
    setFormTitle("");
    setFormDescription("");
    setFormYoutubeUrl("");
    setFormYoutubeError("");
    setPhotos([]);
  }

  function openAddModal() {
    setEditingGuide(null);
    resetForm();
    setFormKind(activeKind);
    setIsModalOpen(true);
  }

  function openEditModal(guide: CleaningGuide) {
    setEditingGuide(guide);
    setFormTitle(guide.title);
    setFormDescription(guide.description ?? "");
    setFormYoutubeUrl(guide.youtube_url ?? "");
    setFormYoutubeError("");
    setFormKind(guide.kind);
    setPhotos(
      guide.photo_urls.map((url) => ({
        id: url,
        file: null,
        preview: url,
        uploadedUrl: url,
      }))
    );
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingGuide(null);
    resetForm();
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const compressed = await Promise.all(
      files.filter((f) => f.type.startsWith("image/")).map(async (f) => {
        const c = await compressImage(f);
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: c.file,
          preview: c.preview || URL.createObjectURL(c.file),
          uploadedUrl: null,
        };
      })
    );
    setPhotos((prev) => [...prev, ...compressed]);
    e.target.value = "";
  }

  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  async function uploadPhoto(file: File): Promise<string | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("property-photos")
      .upload(path, file);
    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("property-photos").getPublicUrl(path);
    return publicUrl;
  }

  async function handleSubmit() {
    if (!formTitle.trim()) return;

    if (formYoutubeUrl.trim() && !extractYouTubeId(formYoutubeUrl.trim())) {
      setFormYoutubeError("올바른 유튜브 링크를 입력해주세요");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setFormYoutubeError("");

    const uploadedUrls: string[] = [];
    for (const photo of photos) {
      if (photo.uploadedUrl) {
        uploadedUrls.push(photo.uploadedUrl);
      } else if (photo.file) {
        const url = await uploadPhoto(photo.file);
        if (!url) {
          setError("사진 업로드에 실패했습니다");
          setIsSubmitting(false);
          return;
        }
        uploadedUrls.push(url);
      }
    }

    const guideData = {
      property_id: propertyId,
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      photo_urls: uploadedUrls,
      youtube_url: formYoutubeUrl.trim() || null,
      kind: formKind,
    };

    if (editingGuide) {
      const { error: updateError } = await supabase
        .from("cleaning_guides")
        .update(guideData)
        .eq("id", editingGuide.id);
      if (updateError) {
        setError("저장에 실패했습니다");
      } else {
        closeModal();
        await fetchGuides();
      }
    } else {
      const sameKind = guides.filter((g) => g.kind === formKind);
      const maxOrder =
        sameKind.length > 0 ? Math.max(...sameKind.map((g) => g.display_order)) + 1 : 0;
      const { error: insertError } = await supabase
        .from("cleaning_guides")
        .insert({ ...guideData, display_order: maxOrder });
      if (insertError) {
        setError("저장에 실패했습니다");
      } else {
        closeModal();
        await fetchGuides();
      }
    }
    setIsSubmitting(false);
  }

  async function handleDelete(guideId: string) {
    if (!confirm("이 항목을 삭제하시겠습니까?")) return;
    setDeletingId(guideId);
    setError("");
    const { error: deleteError } = await supabase
      .from("cleaning_guides")
      .delete()
      .eq("id", guideId);
    if (deleteError) {
      setError("삭제에 실패했습니다");
    } else {
      setGuides((prev) => prev.filter((g) => g.id !== guideId));
    }
    setDeletingId(null);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setError("링크 복사에 실패했습니다");
    }
  }

  if (isFetching) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const filtered = guides.filter((g) => g.kind === activeKind);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">청소 가이드 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            청소 도우미에게 보낼 청소 순서와 용품을 등록하세요
          </p>
        </div>
        <Button onClick={openAddModal}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {KIND_LABELS[activeKind].addBtn}
        </Button>
      </div>

      <Card>
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">청소 도우미 공유 링크</p>
          <p className="text-xs text-gray-500">
            이 링크를 청소 도우미에게 보내주세요. 메인화면이나 메뉴에는 노출되지 않습니다.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={shareLink}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
            />
            <Button variant="secondary" onClick={copyLink} className="shrink-0">
              {linkCopied ? "복사됨" : "링크 복사"}
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Kind tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {KIND_ORDER.map((k) => {
          const count = guides.filter((g) => g.kind === k).length;
          return (
            <button
              key={k}
              onClick={() => setActiveKind(k)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeKind === k
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {KIND_LABELS[k].title}
              {count > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-200 px-1 text-xs">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
            </svg>
          }
          title={`등록된 ${KIND_LABELS[activeKind].title}이(가) 없습니다`}
          description={`${KIND_LABELS[activeKind].title}을(를) 추가해 보세요`}
          action={
            <Button onClick={openAddModal} size="sm">
              {KIND_LABELS[activeKind].addBtn}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((guide, idx) => (
            <Card key={guide.id}>
              <div className="flex items-start gap-3">
                {activeKind === "step" && (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-600">
                    {idx + 1}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-gray-900">{guide.title}</h3>
                  {guide.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                      {guide.description}
                    </p>
                  )}
                  {guide.photo_urls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {guide.photo_urls.map((url) => (
                        <img
                          key={url}
                          src={url}
                          alt=""
                          className="h-20 w-20 rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {guide.youtube_url && (
                    <a
                      href={guide.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                      </svg>
                      유튜브 영상 보기
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(guide)}>
                  수정
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(guide.id)}
                  loading={deletingId === guide.id}
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  삭제
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={
          editingGuide
            ? `${KIND_LABELS[formKind].title} 수정`
            : `${KIND_LABELS[formKind].title} 추가`
        }
      >
        <div className="space-y-4">
          <Input
            label="제목"
            placeholder={KIND_LABELS[formKind].titlePh}
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />

          <Textarea
            label="설명"
            placeholder={KIND_LABELS[formKind].descPh}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            rows={6}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              사진{photos.length > 0 ? ` (${photos.length}장)` : ""}
            </label>
            <p className="mb-2 text-xs text-gray-400">
              여러 장 선택할 수 있고, 버튼을 다시 눌러 더 추가할 수도 있습니다
            </p>

            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <div key={photo.id} className="relative">
                  <img
                    src={photo.preview}
                    alt=""
                    className="h-24 w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 bg-rose-50/30 text-rose-500 transition-colors hover:border-rose-300 hover:bg-rose-50">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="text-xs font-medium">
                  {photos.length === 0 ? "사진 추가" : "더 추가"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {formKind === "step" && (
            <Input
              label="유튜브 영상 링크 (선택)"
              placeholder="https://www.youtube.com/watch?v=..."
              value={formYoutubeUrl}
              onChange={(e) => {
                setFormYoutubeUrl(e.target.value);
                setFormYoutubeError("");
              }}
              error={formYoutubeError}
            />
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSubmit} loading={isSubmitting} disabled={!formTitle.trim()}>
              저장
            </Button>
            <Button variant="ghost" onClick={closeModal}>
              취소
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

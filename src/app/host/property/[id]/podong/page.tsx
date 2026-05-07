"use client";

import { useState, useEffect, useRef, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useI18n } from "@/lib/i18n/context";
import { compressImage } from "@/lib/imageCompression";
import type { PodongPhoto } from "@/types/database";

interface PendingFile {
  file: File;
  preview: string;
  caption: string;
}

export default function PodongPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: propertyId } = use(params);
  const supabase = createClient();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<PodongPhoto[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Multi-file upload state
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState("");

  useEffect(() => {
    fetchPhotos();
  }, [propertyId]);

  async function fetchPhotos() {
    setIsFetching(true);
    const { data } = await supabase
      .from("podong_photos")
      .select("*")
      .eq("property_id", propertyId)
      .order("display_order", { ascending: true });
    setPhotos((data as PodongPhoto[]) ?? []);
    setIsFetching(false);
  }

  async function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPending: PendingFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const compressed = await compressImage(files[i]);
      newPending.push({
        file: compressed.file,
        preview: compressed.preview || URL.createObjectURL(compressed.file),
        caption: "",
      });
    }
    setPendingFiles((prev) => [...prev, ...newPending]);

    // Reset file input so same files can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function updatePendingCaption(index: number, caption: string) {
    setPendingFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, caption } : f))
    );
  }

  function removePending(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUploadAll() {
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setIsUploading(false);
      return;
    }

    let currentMaxOrder =
      photos.length > 0 ? Math.max(...photos.map((p) => p.display_order)) : -1;
    let failCount = 0;

    for (let i = 0; i < pendingFiles.length; i++) {
      const pending = pendingFiles[i];
      setUploadProgress(`${i + 1} / ${pendingFiles.length}`);

      // Upload to storage
      const fileExt = pending.file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("property-photos")
        .upload(filePath, pending.file);

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        failCount++;
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("property-photos").getPublicUrl(filePath);

      currentMaxOrder++;

      // Insert to DB
      const { error: insertError } = await supabase.from("podong_photos").insert({
        property_id: propertyId,
        photo_url: publicUrl,
        caption: pending.caption || null,
        display_order: currentMaxOrder,
      });

      if (insertError) {
        console.error("DB insert error:", insertError.message, insertError.details, insertError.hint);
        failCount++;
      }
    }

    if (failCount > 0) {
      setError(`${failCount}/${pendingFiles.length} ${t("podong.uploadFailed")}`);
    }

    setPendingFiles([]);
    setUploadProgress("");
    await fetchPhotos();
    setIsUploading(false);
  }

  async function handleSaveCaption(photoId: string) {
    setError("");
    const { error: updateError } = await supabase
      .from("podong_photos")
      .update({ caption: editCaption || null })
      .eq("id", photoId);

    if (updateError) {
      console.error("Caption update error:", updateError);
      setError(t("podong.saveFailed"));
    } else {
      setEditingId(null);
      await fetchPhotos();
    }
  }

  async function handleDelete(photoId: string) {
    if (!confirm(t("podong.deleteConfirm"))) return;

    setDeletingId(photoId);
    setError("");

    const { error: deleteError } = await supabase
      .from("podong_photos")
      .delete()
      .eq("id", photoId);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      setError(t("podong.deleteFailed"));
    } else {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    }
    setDeletingId(null);
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;
    const updated = [...photos];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setPhotos(updated);
    await Promise.all(
      updated.map((p, i) =>
        supabase.from("podong_photos").update({ display_order: i }).eq("id", p.id)
      )
    );
  }

  async function handleMoveDown(index: number) {
    if (index === photos.length - 1) return;
    const updated = [...photos];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setPhotos(updated);
    await Promise.all(
      updated.map((p, i) =>
        supabase.from("podong_photos").update({ display_order: i }).eq("id", p.id)
      )
    );
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("podong.hostTitle")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("podong.hostSubtitle")}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Upload Form */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">{t("podong.addPhoto")}</h2>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-rose-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-rose-600 hover:file:bg-rose-100"
          />
        </div>

        {/* Pending files preview */}
        {pendingFiles.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {pendingFiles.map((pending, index) => (
                <div key={index} className="relative overflow-hidden rounded-lg border border-gray-200">
                  <div className="aspect-square overflow-hidden">
                    <img src={pending.preview} alt="" className="h-full w-full object-cover" />
                  </div>
                  <button
                    onClick={() => removePending(index)}
                    className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="p-2">
                    <input
                      type="text"
                      value={pending.caption}
                      onChange={(e) => updatePendingCaption(index, e.target.value)}
                      placeholder={t("podong.captionPlaceholder")}
                      className="w-full rounded border border-gray-200 px-2 py-1 text-xs placeholder:text-gray-400 focus:border-rose-400 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleUploadAll} loading={isUploading}>
                {isUploading
                  ? uploadProgress
                  : `${pendingFiles.length}${pendingFiles.length === 1 ? "" : ""} ${t("podong.addPhoto")}`}
              </Button>
              {!isUploading && (
                <Button variant="ghost" onClick={() => setPendingFiles([])}>
                  {t("common.cancel")}
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Photo Grid */}
      {photos.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          }
          title={t("podong.noPhotos")}
          description={t("podong.noPhotosHostDesc")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {photos.map((photo, index) => (
            <Card key={photo.id} className="relative overflow-hidden p-0">
              <div className="aspect-square overflow-hidden">
                <img
                  src={photo.photo_url}
                  alt={photo.caption || "Podong"}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-3 p-4">
                {editingId === photo.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      placeholder={t("podong.captionPlaceholder")}
                    />
                    <Button size="sm" onClick={() => handleSaveCaption(photo.id)}>
                      {t("common.save")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      {t("common.cancel")}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    {photo.caption || <span className="italic text-gray-400">{t("podong.captionPlaceholder")}</span>}
                  </p>
                )}
                <div className="flex gap-2 border-t border-gray-100 pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingId(photo.id);
                      setEditCaption(photo.caption || "");
                    }}
                  >
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(photo.id)}
                    loading={deletingId === photo.id}
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    {t("common.delete")}
                  </Button>
                  {index > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => handleMoveUp(index)}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                      </svg>
                    </Button>
                  )}
                  {index < photos.length - 1 && (
                    <Button variant="ghost" size="sm" onClick={() => handleMoveDown(index)}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

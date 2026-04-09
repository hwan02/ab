"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import {
  compressImage,
  formatFileSize,
  isFileTooLarge,
  isImageFile,
  type CompressedFile,
} from "@/lib/imageCompression";

interface MediaUploadButtonProps {
  chatRoomId: string;
  senderId: string;
  onUploaded?: () => void;
}

function MediaUploadButton({ chatRoomId, senderId, onUploaded }: MediaUploadButtonProps) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<CompressedFile | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (isFileTooLarge(file)) {
      setError(t("chat.fileTooLarge"));
      return;
    }

    try {
      if (isImageFile(file)) {
        const compressed = await compressImage(file);
        setPreview(compressed);
        setSelectedFile(compressed.file);
      } else {
        setSelectedFile(file);
        setPreview(null);
      }
    } catch {
      setError(t("chat.fileProcessError"));
    }

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || uploading) return;

    setUploading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const ext = selectedFile.name.split(".").pop() || "bin";
      const filePath = `${chatRoomId}/${timestamp}-${random}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-media")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("chat-media").getPublicUrl(filePath);

      const isImage = isImageFile(selectedFile);
      const messageContent = JSON.stringify({
        url: publicUrl,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
      });

      const { error: msgError } = await supabase.from("messages").insert({
        chat_room_id: chatRoomId,
        sender_id: senderId,
        content: messageContent,
        message_type: isImage ? "image" : "file",
      });

      if (msgError) throw msgError;

      setSelectedFile(null);
      setPreview(null);
      onUploaded?.();
    } catch {
      setError(t("chat.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPreview(null);
    setError(null);
  };

  // Preview / confirmation panel
  if (selectedFile) {
    return (
      <div className="border-t border-gray-200 bg-gray-50 p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {isImageFile(selectedFile) ? t("chat.sendPhoto") : t("chat.sendFile")}
          </span>
          <button
            onClick={handleCancel}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            {t("common.close")}
          </button>
        </div>

        {/* Image preview */}
        {preview?.preview && (
          <div className="mb-3 overflow-hidden rounded-xl">
            <img
              src={preview.preview}
              alt="Preview"
              className="max-h-48 w-auto rounded-xl object-contain"
            />
          </div>
        )}

        {/* File info */}
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-white p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg">
            {isImageFile(selectedFile) ? "🖼️" : "📎"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {selectedFile.name}
            </p>
            <p className="text-xs text-gray-500">
              {formatFileSize(selectedFile.size)}
              {preview && preview.originalSize !== preview.compressedSize && (
                <span className="ml-1 text-green-600">
                  ({formatFileSize(preview.originalSize)} → {formatFileSize(preview.compressedSize)}, {t("chat.compressed")})
                </span>
              )}
            </p>
          </div>
        </div>

        {error && (
          <p className="mb-2 text-xs text-red-500">{error}</p>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-50"
        >
          {uploading ? t("chat.uploading") : t("chat.send")}
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.hwp"
        onChange={handleFileSelect}
        className="hidden"
      />
      {error && (
        <p className="mb-1 text-xs text-red-500">{error}</p>
      )}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        title={t("chat.attachMedia")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
      </button>
    </>
  );
}

export { MediaUploadButton, type MediaUploadButtonProps };

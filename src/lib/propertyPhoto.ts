import type { SupabaseClient } from "@supabase/supabase-js";
import { compressImage } from "@/lib/imageCompression";

const BUCKET = "property-photos";

/** 메인 이미지를 압축해 올리고 공개 URL 을 돌려준다. 실패하면 null. */
export async function uploadMainPhoto(supabase: SupabaseClient, userId: string, file: File): Promise<string | null> {
  const { file: compressed } = await compressImage(file);
  const ext = (compressed.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed);
  if (error) {
    console.error("Photo upload error:", error);
    return null;
  }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** 공개 URL 로 올라간 파일을 지운다. 버킷 밖 URL 이면 무시. */
export async function removePhotoByUrl(supabase: SupabaseClient, url: string | null): Promise<void> {
  if (!url) return;
  const match = url.match(/property-photos\/(.+)$/);
  if (!match) return;
  await supabase.storage.from(BUCKET).remove([match[1]]);
}

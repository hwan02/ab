/**
 * 구글 장소 사진을 받아 Supabase Storage 에 저장한다.
 *
 * POST /api/places/save-photo
 *   인증: 로그인 세션. property_id 숙소의 호스트(host_id == user.id)만.
 *   body: { url: string, property_id: string }
 *     url 은 https 이고 *.googleusercontent.com / *.googleapis.com 만 받는다(SSRF 차단).
 *     리다이렉트도 같은 허용 목록 안에서만 따라간다.
 *
 * 업로드는 서비스 롤이 아니라 호출자의 세션으로 한다(스토리지 정책: 로그인 사용자만 업로드,
 * 경로 첫 폴더가 자기 uid 여야 삭제 가능).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ALLOWED_HOST_SUFFIXES = [".googleusercontent.com", ".googleapis.com"];
const MAX_REDIRECTS = 3;
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseAllowedImageUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const allowed = ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix.slice(1) || host.endsWith(suffix)
  );
  return allowed ? url : null;
}

/** 리다이렉트를 수동으로 따라가며 매 단계 허용 도메인인지 확인한다. */
async function fetchFromAllowedHost(start: URL): Promise<Response | null> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      let resolved: string;
      try {
        resolved = new URL(location, current).toString();
      } catch {
        return null;
      }
      const next = parseAllowedImageUrl(resolved);
      if (!next) return null;
      current = next;
      continue;
    }
    return res;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { url?: unknown; property_id?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }

  const { url, property_id: propertyId } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }
  if (!propertyId || typeof propertyId !== "string" || !UUID_RE.test(propertyId)) {
    return NextResponse.json({ error: "property_id required" }, { status: 400 });
  }

  const imageUrl = parseAllowedImageUrl(url);
  if (!imageUrl) {
    return NextResponse.json(
      { error: "url must be https and on googleusercontent.com / googleapis.com" },
      { status: 400 }
    );
  }

  // 숙소 호스트 본인만. (properties RLS 로도 자기 숙소만 보이지만 host_id 를 명시적으로 확인한다)
  const { data: property } = await supabase
    .from("properties")
    .select("id, host_id")
    .eq("id", propertyId)
    .maybeSingle<{ id: string; host_id: string }>();
  if (!property || property.host_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const res = await fetchFromAllowedHost(imageUrl);
    if (!res || !res.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
    }

    const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 415 });
    }
    const declaredLength = Number(res.headers.get("content-length") || 0);
    if (declaredLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const filePath = `${user.id}/places-${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("property-photos")
      .upload(filePath, new Uint8Array(buffer), { contentType });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("property-photos").getPublicUrl(filePath);

    return NextResponse.json({ photo_url: publicUrl });
  } catch (err) {
    console.error("save-photo error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

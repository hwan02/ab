/**
 * 구글 장소 사진을 받아 Supabase Storage 에 저장한다.
 *
 * POST /api/places/save-photo
 *   인증: 로그인 세션. property_id 숙소의 호스트(host_id == user.id)만.
 *   body: { url: string, property_id: string }
 *     url 은 https 이고 *.googleusercontent.com(사진 CDN) 또는 maps/places.googleapis.com(Places 사진 API)만
 *     받는다(SSRF 차단). storage.googleapis.com 같은 임의 공개 버킷은 막는다.
 *     리다이렉트도 같은 허용 목록 안에서만 따라간다. 응답 본문은 10MB 까지만 읽는다.
 *
 * 업로드는 서비스 롤이 아니라 호출자의 세션으로 한다(스토리지 정책: 로그인 사용자만 업로드,
 * 경로 첫 폴더가 자기 uid 여야 삭제 가능).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** 와일드카드 허용: 구글 사진 CDN(lh3.googleusercontent.com 등). */
const ALLOWED_HOST_SUFFIXES = [".googleusercontent.com"];
/** 정확히 일치해야 하는 호스트: Places 사진 API(리다이렉트 시작점). storage.googleapis.com 등은 제외. */
const ALLOWED_HOSTS = new Set(["maps.googleapis.com", "places.googleapis.com"]);
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
  const allowed =
    ALLOWED_HOSTS.has(host) ||
    ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
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

/** 본문을 스트리밍으로 읽되 MAX_BYTES 를 넘으면 즉시 중단한다(content-length 가 없는 응답 대비). */
async function readBodyCapped(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
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
      { error: "url must be https and on *.googleusercontent.com or maps/places.googleapis.com" },
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

    const bytes = await readBodyCapped(res, MAX_BYTES);
    if (!bytes || bytes.byteLength === 0) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const filePath = `${user.id}/places-${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("property-photos")
      .upload(filePath, bytes, { contentType });

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

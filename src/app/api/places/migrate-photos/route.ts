/**
 * 숙소의 주변 장소 사진을 구글 Places API 에서 받아 Supabase Storage 로 옮긴다.
 *
 * POST /api/places/migrate-photos
 *   인증: 로그인 세션이면서 관리자(NEXT_PUBLIC_ADMIN_EMAIL)만. 구글 API 비용이 드는 일괄 작업이라
 *        호스트 개별 권한이 아니라 관리자로 제한한다. 비관리자 호스트가 버튼을 누르면 403 과 한국어 안내가 간다.
 *   body: { property_id: string }
 *
 * DB·스토리지 쓰기는 서비스 롤(createAdminClient)로 한다.
 * 호출: src/app/host/property/[id]/nearby/page.tsx (same-origin fetch → 세션 쿠키가 함께 간다).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 서버 전용 키(GOOGLE_MAPS_SERVER_KEY)가 있으면 그것을, 없으면 클라이언트 번들에도 들어가는 NEXT_PUBLIC 키를 쓴다.
// NEXT_PUBLIC_ 키는 어차피 공개돼 있으므로 '서버 키 보호'는 서버 전용 키를 설정해야 실효가 있다.
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://popostay.vercel.app";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function fetchGooglePhoto(photoRef: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  // Use Places Photo REST API with referer header to bypass restriction
  const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${GOOGLE_MAPS_API_KEY}`;

  const res = await fetch(photoUrl, {
    redirect: "follow",
    headers: { Referer: SITE_URL },
  });

  if (!res.ok) return null;

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = await res.arrayBuffer();
  return { buffer, contentType };
}

export async function POST(req: NextRequest) {
  // 1) 로그인 + 관리자
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  if (!adminEmail || user.email !== adminEmail) {
    // 호출처(host nearby 페이지)는 이 문구를 그대로 화면에 보여 준다.
    return NextResponse.json({ error: "관리자만 사진을 가져올 수 있습니다" }, { status: 403 });
  }

  try {
    let body: { property_id?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON body required" }, { status: 400 });
    }
    const propertyId = body.property_id;

    if (!propertyId || typeof propertyId !== "string" || !UUID_RE.test(propertyId)) {
      return NextResponse.json({ error: "property_id required" }, { status: 400 });
    }
    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not configured" }, { status: 500 });
    }

    let supabase: ReturnType<typeof createAdminClient>;
    try {
      supabase = createAdminClient();
    } catch {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { data: property } = await supabase
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .maybeSingle<{ id: string }>();
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const { data: places, error: fetchError } = await supabase
      .from("nearby_places")
      .select("id, name, photo_url, google_place_id")
      .eq("property_id", propertyId);

    if (fetchError) {
      return NextResponse.json({ error: `DB error: ${fetchError.message}` }, { status: 500 });
    }
    if (!places || places.length === 0) {
      return NextResponse.json({ message: "No places found", migrated: 0 });
    }

    const needsMigration = places.filter(
      (p) => p.google_place_id && (!p.photo_url || !p.photo_url.includes("supabase.co/storage"))
    );

    if (needsMigration.length === 0) {
      return NextResponse.json({ message: "All photos already saved", migrated: 0 });
    }

    let migrated = 0;
    const errors: string[] = [];

    for (const place of needsMigration) {
      try {
        // Step 1: Get photo_reference from Place Details
        const detailsRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place.google_place_id!)}&fields=photos&key=${GOOGLE_MAPS_API_KEY}`,
          { headers: { Referer: SITE_URL } }
        );
        const details = await detailsRes.json();

        if (details.status === "REQUEST_DENIED") {
          errors.push(`${place.name}: API denied - ${details.error_message || "check API key"}`);
          continue;
        }

        const photoRef = details.result?.photos?.[0]?.photo_reference;
        if (!photoRef) {
          errors.push(`${place.name}: no photo available`);
          continue;
        }

        // Step 2: Download photo
        const photo = await fetchGooglePhoto(photoRef);
        if (!photo) {
          errors.push(`${place.name}: download failed`);
          continue;
        }

        // Step 3: Upload to Supabase storage
        const ext = photo.contentType.includes("png") ? "png" : photo.contentType.includes("webp") ? "webp" : "jpg";
        const filePath = `places/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("property-photos")
          .upload(filePath, new Uint8Array(photo.buffer), { contentType: photo.contentType });

        if (uploadError) {
          errors.push(`${place.name}: upload failed - ${uploadError.message}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("property-photos")
          .getPublicUrl(filePath);

        // Step 4: Update DB
        await supabase
          .from("nearby_places")
          .update({ photo_url: publicUrl })
          .eq("id", place.id);

        migrated++;
      } catch (err) {
        errors.push(`${place.name}: ${err instanceof Error ? err.message : "error"}`);
      }
    }

    return NextResponse.json({ migrated, total: needsMigration.length, errors: errors.length > 0 ? errors : undefined });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

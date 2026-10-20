/**
 * 구글 장소 ID 로 대표 사진 URL 을 찾는다(서버의 Google Maps 키 사용).
 *
 * GET /api/places/photo?place_id=...
 *   인증: 로그인 세션 필요(누구나 서버 키로 구글 API 를 호출하지 못하게).
 * 호출: src/app/host/property/[id]/nearby/page.tsx
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 서버 전용 키(GOOGLE_MAPS_SERVER_KEY)가 있으면 우선. NEXT_PUBLIC 키는 번들에 노출돼 있어 로그인 검사만으로는
// '서버 키 무단 사용'을 막지 못하므로, 실제 보호는 서버 전용 키를 두고 NEXT_PUBLIC 키에 HTTP 리퍼러 제한을 걸어야 한다.
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const placeId = req.nextUrl.searchParams.get("place_id");

  if (!placeId) {
    return NextResponse.json({ error: "place_id required" }, { status: 400 });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: "Google Maps not configured" }, { status: 503 });
  }

  try {
    // Fetch place details to get photo_reference
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=photos&key=${GOOGLE_MAPS_API_KEY}`;
    const detailsRes = await fetch(detailsUrl);
    const details = await detailsRes.json();

    const photoRef = details.result?.photos?.[0]?.photo_reference;
    if (!photoRef) {
      return NextResponse.json({ photo_url: null });
    }

    // Construct the photo URL - this redirects to the actual image
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${GOOGLE_MAPS_API_KEY}`;

    // Follow the redirect to get the final lh3.googleusercontent.com URL
    const photoRes = await fetch(photoUrl, { redirect: "follow" });
    const finalUrl = photoRes.url;

    return NextResponse.json({ photo_url: finalUrl });
  } catch {
    return NextResponse.json({ error: "Failed to fetch photo" }, { status: 500 });
  }
}

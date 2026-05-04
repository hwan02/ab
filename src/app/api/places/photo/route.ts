import { NextRequest, NextResponse } from "next/server";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function GET(req: NextRequest) {
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
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;

    // Follow the redirect to get the final lh3.googleusercontent.com URL
    const photoRes = await fetch(photoUrl, { redirect: "follow" });
    const finalUrl = photoRes.url;

    return NextResponse.json({ photo_url: finalUrl });
  } catch {
    return NextResponse.json({ error: "Failed to fetch photo" }, { status: 500 });
  }
}

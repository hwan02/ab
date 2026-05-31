import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://popostay.vercel.app";

export const maxDuration = 120;

async function fetchGooglePhoto(photoRef: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  // Use Places Photo REST API with referer header to bypass restriction
  const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;

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
  try {
    const { property_id } = await req.json();

    if (!property_id) {
      return NextResponse.json({ error: "property_id required" }, { status: 400 });
    }
    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not configured" }, { status: 500 });
    }

    const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
    if (!key || !SUPABASE_URL) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }
    const supabase = createClient(SUPABASE_URL, key);

    const { data: places, error: fetchError } = await supabase
      .from("nearby_places")
      .select("id, name, photo_url, google_place_id")
      .eq("property_id", property_id);

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

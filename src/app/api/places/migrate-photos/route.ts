import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function POST(req: NextRequest) {
  const { property_id } = await req.json();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get all nearby places for this property
  const { data: places } = await supabase
    .from("nearby_places")
    .select("id, name, photo_url, google_place_id")
    .eq("property_id", property_id);

  if (!places || places.length === 0) {
    return NextResponse.json({ message: "No places found", migrated: 0 });
  }

  // Filter places that need migration (no photo or non-Supabase URL)
  const needsMigration = places.filter(
    (p) => p.google_place_id && (!p.photo_url || !p.photo_url.includes("supabase.co/storage"))
  );

  let migrated = 0;

  for (const place of needsMigration) {
    try {
      // Step 1: Get photo URL from Google Places API
      let googlePhotoUrl: string | null = null;

      if (GOOGLE_MAPS_API_KEY && place.google_place_id) {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place.google_place_id)}&fields=photos&key=${GOOGLE_MAPS_API_KEY}`;
        const detailsRes = await fetch(detailsUrl);
        const details = await detailsRes.json();
        const photoRef = details.result?.photos?.[0]?.photo_reference;

        if (photoRef) {
          const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
          const photoRes = await fetch(photoUrl, { redirect: "follow" });
          googlePhotoUrl = photoRes.url;
        }
      }

      if (!googlePhotoUrl) continue;

      // Step 2: Download the image
      const imgRes = await fetch(googlePhotoUrl);
      if (!imgRes.ok) continue;

      const contentType = imgRes.headers.get("content-type") || "image/jpeg";
      const buffer = await imgRes.arrayBuffer();

      // Step 3: Upload to Supabase storage
      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const filePath = `places/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("property-photos")
        .upload(filePath, Buffer.from(buffer), { contentType });

      if (uploadError) {
        console.error(`Upload failed for ${place.name}:`, uploadError);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("property-photos")
        .getPublicUrl(filePath);

      // Step 4: Update DB with permanent URL
      await supabase
        .from("nearby_places")
        .update({ photo_url: publicUrl })
        .eq("id", place.id);

      migrated++;
      console.log(`Migrated photo for: ${place.name}`);
    } catch (err) {
      console.error(`Failed for ${place.name}:`, err);
    }
  }

  return NextResponse.json({
    message: `Migrated ${migrated}/${needsMigration.length} photos`,
    migrated,
    total: needsMigration.length,
  });
}

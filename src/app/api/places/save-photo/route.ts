import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  try {
    // Download image from Google
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();

    // Upload to Supabase storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const filePath = `places/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("property-photos")
      .upload(filePath, Buffer.from(buffer), { contentType });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from("property-photos")
      .getPublicUrl(filePath);

    return NextResponse.json({ photo_url: publicUrl });
  } catch (err) {
    console.error("save-photo error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

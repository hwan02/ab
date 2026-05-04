import { createClient } from "@/lib/supabase/server";
import NearbyPageContent from "@/components/nearby/NearbyPageContent";
import type { NearbyPlace, Property } from "@/types/database";

interface NearbyPageProps {
  params: Promise<{ id: string }>;
}

export default async function NearbyPage({ params }: NearbyPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [placesResult, propertyResult] = await Promise.all([
    supabase
      .from("nearby_places")
      .select("*")
      .eq("property_id", id)
      .order("category", { ascending: true })
      .order("name", { ascending: true })
      .returns<NearbyPlace[]>(),
    supabase
      .from("properties")
      .select("latitude, longitude")
      .eq("id", id)
      .single<Pick<Property, "latitude" | "longitude">>(),
  ]);

  return (
    <NearbyPageContent
      places={placesResult.data}
      propertyId={id}
      propertyLat={propertyResult.data?.latitude}
      propertyLng={propertyResult.data?.longitude}
    />
  );
}

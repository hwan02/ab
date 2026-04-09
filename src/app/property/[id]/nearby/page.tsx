import { createClient } from "@/lib/supabase/server";
import NearbyPageContent from "@/components/nearby/NearbyPageContent";
import type { NearbyPlace } from "@/types/database";

interface NearbyPageProps {
  params: Promise<{ id: string }>;
}

export default async function NearbyPage({ params }: NearbyPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: places } = await supabase
    .from("nearby_places")
    .select("*")
    .eq("property_id", id)
    .order("category", { ascending: true })
    .order("name", { ascending: true })
    .returns<NearbyPlace[]>();

  return <NearbyPageContent places={places} />;
}

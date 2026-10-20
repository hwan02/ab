import { createClient } from "@/lib/supabase/server";
import NearbyPageContent from "@/components/nearby/NearbyPageContent";
import type { NearbyPlace, Property } from "@/types/database";

interface NearbyPageProps {
  params: Promise<{ id: string }>;
}

export default async function NearbyPage({ params }: NearbyPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // 좌표: 공개 뷰는 소수점 2자리로 뭉개진 값(비로그인·미등록 게스트용 지도 중심),
  // properties 테이블은 RLS 로 호스트·등록 게스트에게만 정확한 값이 보인다. 보이면 그것을 쓴다.
  const [placesResult, publicResult, privateResult] = await Promise.all([
    supabase
      .from("nearby_places")
      .select("*")
      .eq("property_id", id)
      .order("category", { ascending: true })
      .order("name", { ascending: true })
      .returns<NearbyPlace[]>(),
    supabase
      .from("properties_public")
      .select("latitude, longitude")
      .eq("id", id)
      .maybeSingle<Pick<Property, "latitude" | "longitude">>(),
    supabase
      .from("properties")
      .select("latitude, longitude")
      .eq("id", id)
      .maybeSingle<Pick<Property, "latitude" | "longitude">>(),
  ]);

  const coords = privateResult.data ?? publicResult.data;

  return (
    <NearbyPageContent
      places={placesResult.data}
      propertyId={id}
      propertyLat={coords?.latitude}
      propertyLng={coords?.longitude}
    />
  );
}

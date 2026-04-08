import { createClient } from "@/lib/supabase/server";
import NearbyList from "@/components/nearby/NearbyList";
import { EmptyState } from "@/components/ui/EmptyState";
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

  return (
    <div className="px-4 py-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">주변 탐색</h2>
        <p className="mt-1 text-sm text-gray-500">
          숙소 근처의 추천 장소를 확인하세요
        </p>
      </div>

      {!places || places.length === 0 ? (
        <EmptyState
          title="등록된 장소가 없습니다"
          description="호스트가 주변 장소를 등록하면 여기에 표시됩니다."
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
              />
            </svg>
          }
        />
      ) : (
        <NearbyList places={places} />
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { NearbyPlaceForm } from "@/components/nearby/NearbyPlaceForm";
import type { NearbyPlace } from "@/types/database";

const categories = [
  { key: "attraction" as const, label: "볼거리" },
  { key: "restaurant" as const, label: "먹거리" },
  { key: "convenience" as const, label: "편의시설" },
  { key: "experience" as const, label: "체험" },
];

export default function NearbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: propertyId } = use(params);
  const supabase = createClient();
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [activeCategory, setActiveCategory] =
    useState<NearbyPlace["category"]>("attraction");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<NearbyPlace | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPlaces();
  }, [propertyId]);

  async function fetchPlaces() {
    setIsFetching(true);
    const { data, error: fetchError } = await supabase
      .from("nearby_places")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError("주변 장소를 불러오는데 실패했습니다.");
      console.error("Fetch error:", fetchError);
    } else {
      setPlaces((data as NearbyPlace[]) ?? []);
    }
    setIsFetching(false);
  }

  async function handleAddPlace(data: {
    name: string;
    description: string;
    address: string;
    category: NearbyPlace["category"];
    phone: string;
    map_url: string;
  }) {
    setIsSubmitting(true);
    setError("");

    const { error: insertError } = await supabase
      .from("nearby_places")
      .insert({
        property_id: propertyId,
        name: data.name,
        description: data.description || null,
        address: data.address || null,
        category: data.category,
        phone: data.phone || null,
        map_url: data.map_url || null,
      });

    if (insertError) {
      setError("장소 추가에 실패했습니다.");
      console.error("Insert error:", insertError);
    } else {
      setIsModalOpen(false);
      await fetchPlaces();
    }
    setIsSubmitting(false);
  }

  async function handleEditPlace(data: {
    name: string;
    description: string;
    address: string;
    category: NearbyPlace["category"];
    phone: string;
    map_url: string;
  }) {
    if (!editingPlace) return;

    setIsSubmitting(true);
    setError("");

    const { error: updateError } = await supabase
      .from("nearby_places")
      .update({
        name: data.name,
        description: data.description || null,
        address: data.address || null,
        category: data.category,
        phone: data.phone || null,
        map_url: data.map_url || null,
      })
      .eq("id", editingPlace.id);

    if (updateError) {
      setError("장소 수정에 실패했습니다.");
      console.error("Update error:", updateError);
    } else {
      setEditingPlace(null);
      setIsModalOpen(false);
      await fetchPlaces();
    }
    setIsSubmitting(false);
  }

  async function handleDeletePlace(placeId: string) {
    if (!confirm("이 장소를 삭제하시겠습니까?")) return;

    setDeletingId(placeId);
    setError("");

    const { error: deleteError } = await supabase
      .from("nearby_places")
      .delete()
      .eq("id", placeId);

    if (deleteError) {
      setError("장소 삭제에 실패했습니다.");
      console.error("Delete error:", deleteError);
    } else {
      setPlaces((prev) => prev.filter((p) => p.id !== placeId));
    }
    setDeletingId(null);
  }

  function openAddModal() {
    setEditingPlace(null);
    setIsModalOpen(true);
  }

  function openEditModal(place: NearbyPlace) {
    setEditingPlace(place);
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingPlace(null);
    setIsModalOpen(false);
  }

  const filteredPlaces = places.filter((p) => p.category === activeCategory);

  if (isFetching) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">주변 장소</h1>
          <p className="mt-1 text-sm text-gray-500">
            게스트에게 추천할 주변 장소를 관리하세요.
          </p>
        </div>
        <Button onClick={openAddModal}>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          장소 추가
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {categories.map((cat) => {
          const count = places.filter((p) => p.category === cat.key).length;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeCategory === cat.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {cat.label}
              {count > 0 && (
                <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filteredPlaces.length === 0 ? (
        <EmptyState
          icon={
            <svg
              className="h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
              />
            </svg>
          }
          title="등록된 장소가 없습니다"
          description="이 카테고리에 장소를 추가해보세요."
          action={
            <Button onClick={openAddModal} size="sm">
              장소 추가
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filteredPlaces.map((place) => (
            <Card key={place.id} className="relative">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-gray-900">
                  {place.name}
                </h3>
                {place.description && (
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {place.description}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 text-sm text-gray-500">
                {place.address && (
                  <div className="flex items-start gap-2">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                      />
                    </svg>
                    <span>{place.address}</span>
                  </div>
                )}
                {place.phone && (
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
                      />
                    </svg>
                    <span>{place.phone}</span>
                  </div>
                )}
                {place.map_url && (
                  <a
                    href={place.map_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-600"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                      />
                    </svg>
                    지도 보기
                  </a>
                )}
              </div>

              <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditModal(place)}
                >
                  수정
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeletePlace(place.id)}
                  loading={deletingId === place.id}
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  삭제
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingPlace ? "장소 수정" : "장소 추가"}
      >
        <NearbyPlaceForm
          initialData={editingPlace ?? undefined}
          onSubmit={editingPlace ? handleEditPlace : handleAddPlace}
          onCancel={closeModal}
          isLoading={isSubmitting}
        />
      </Modal>
    </div>
  );
}

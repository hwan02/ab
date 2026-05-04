"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { NearbyPlaceForm } from "@/components/nearby/NearbyPlaceForm";
import GoogleMapsProvider from "@/components/maps/GoogleMapsProvider";
import { useI18n } from "@/lib/i18n/context";
import type { NearbyPlace, PlaceRecommendation } from "@/types/database";

export default function NearbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: propertyId } = use(params);

  return (
    <GoogleMapsProvider>
      <NearbyPageInner propertyId={propertyId} />
    </GoogleMapsProvider>
  );
}

function NearbyPageInner({ propertyId }: { propertyId: string }) {
  const supabase = createClient();
  const { t } = useI18n();

  const categories = [
    { key: "attraction" as const, label: t("nearby.attraction") },
    { key: "restaurant" as const, label: t("nearby.restaurant") },
    { key: "convenience" as const, label: t("nearby.convenience") },
    { key: "experience" as const, label: t("nearby.experience") },
  ];
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [recommendations, setRecommendations] = useState<PlaceRecommendation[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [activeCategory, setActiveCategory] =
    useState<NearbyPlace["category"]>("attraction");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<NearbyPlace | null>(null);
  const [editingRec, setEditingRec] = useState<PlaceRecommendation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isFetchingPhotos, setIsFetchingPhotos] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPlaces(true);
    fetchRecommendations();
  }, [propertyId]);

  async function fetchPlaces(showSpinner = false) {
    if (showSpinner) setIsFetching(true);
    const { data, error: fetchError } = await supabase
      .from("nearby_places")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(t("nearby.fetchFailed"));
    } else {
      setPlaces((data as NearbyPlace[]) ?? []);
    }
    if (showSpinner) setIsFetching(false);
  }

  async function fetchRecommendations() {
    const { data } = await supabase
      .from("place_recommendations")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });
    setRecommendations((data as PlaceRecommendation[]) ?? []);
  }

  async function handleApproveRec(rec: PlaceRecommendation) {
    await supabase.from("place_recommendations").update({ status: "approved" }).eq("id", rec.id);
    await supabase.from("nearby_places").insert({
      property_id: propertyId,
      name: rec.name,
      category: rec.category,
      description: rec.description,
      address: rec.address,
      map_url: rec.map_url,
      photo_url: rec.photo_url,
    });
    fetchRecommendations();
    fetchPlaces();
  }

  async function handleRejectRec(id: string) {
    await supabase.from("place_recommendations").update({ status: "rejected" }).eq("id", id);
    fetchRecommendations();
  }

  function handleEditRec(rec: PlaceRecommendation) {
    setEditingPlace(null);
    setEditingRec(rec);
    setIsModalOpen(true);
  }

  type PlaceFormData = {
    name: string;
    description: string;
    address: string;
    category: NearbyPlace["category"];
    phone: string;
    map_url: string;
    latitude?: number;
    longitude?: number;
    google_place_id?: string;
    photo_url?: string;
    photo_file?: File;
  };

  async function uploadPhoto(file: File): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("property-photos")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Photo upload error:", uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("property-photos")
      .getPublicUrl(filePath);

    return publicUrl;
  }

  async function resolvePhotoUrl(data: PlaceFormData): Promise<string | null> {
    if (data.photo_file) {
      return await uploadPhoto(data.photo_file);
    }
    return data.photo_url || null;
  }

  async function handleSubmitRec(data: PlaceFormData) {
    if (!editingRec) return;

    setIsSubmitting(true);
    setError("");

    const photoUrl = await resolvePhotoUrl(data);

    await supabase.from("place_recommendations").update({ status: "approved" }).eq("id", editingRec.id);

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
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        google_place_id: data.google_place_id || null,
        photo_url: photoUrl,
      });

    if (insertError) {
      setError(t("nearby.addFailed"));
    } else {
      setEditingRec(null);
      setIsModalOpen(false);
      await fetchPlaces();
      await fetchRecommendations();
    }
    setIsSubmitting(false);
  }

  async function handleAddPlace(data: PlaceFormData) {
    setIsSubmitting(true);
    setError("");

    const photoUrl = await resolvePhotoUrl(data);

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
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        google_place_id: data.google_place_id || null,
        photo_url: photoUrl,
      });

    if (insertError) {
      setError(t("nearby.addFailed"));
      console.error("Insert error:", insertError);
    } else {
      setIsModalOpen(false);
      await fetchPlaces();
    }
    setIsSubmitting(false);
  }

  async function handleEditPlace(data: PlaceFormData) {
    if (!editingPlace) return;

    setIsSubmitting(true);
    setError("");

    const photoUrl = await resolvePhotoUrl(data);

    const { error: updateError } = await supabase
      .from("nearby_places")
      .update({
        name: data.name,
        description: data.description || null,
        address: data.address || null,
        category: data.category,
        phone: data.phone || null,
        map_url: data.map_url || null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        google_place_id: data.google_place_id || null,
        photo_url: photoUrl,
      })
      .eq("id", editingPlace.id);

    if (updateError) {
      setError(t("nearby.editFailed"));
      console.error("Update error:", updateError);
    } else {
      setEditingPlace(null);
      setIsModalOpen(false);
      await fetchPlaces();
    }
    setIsSubmitting(false);
  }

  async function handleDeletePlace(placeId: string) {
    if (!confirm(t("nearby.deleteConfirmPlace"))) return;

    setDeletingId(placeId);
    setError("");

    const { error: deleteError } = await supabase
      .from("nearby_places")
      .delete()
      .eq("id", placeId);

    if (deleteError) {
      setError(t("nearby.deleteFailed"));
      console.error("Delete error:", deleteError);
    } else {
      setPlaces((prev) => prev.filter((p) => p.id !== placeId));
    }
    setDeletingId(null);
  }

  async function handleFetchPhotos() {
    const placesWithoutPhoto = places.filter(
      (p) => p.google_place_id && !p.photo_url
    );
    if (placesWithoutPhoto.length === 0) return;

    setIsFetchingPhotos(true);
    setError("");

    for (const place of placesWithoutPhoto) {
      try {
        const res = await fetch(
          `/api/places/photo?place_id=${encodeURIComponent(place.google_place_id!)}`
        );
        const data = await res.json();
        if (data.photo_url) {
          await supabase
            .from("nearby_places")
            .update({ photo_url: data.photo_url })
            .eq("id", place.id);
        }
      } catch {
        // Skip individual failures
      }
    }

    await fetchPlaces();
    setIsFetchingPhotos(false);
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
    setEditingRec(null);
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
          <h1 className="text-2xl font-bold text-gray-900">{t("nearby.hostTitle")}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("nearby.hostSubtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          {places.some((p) => p.google_place_id && !p.photo_url) && (
            <Button
              variant="secondary"
              onClick={handleFetchPhotos}
              loading={isFetchingPhotos}
            >
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
                  d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                />
              </svg>
              {t("nearby.fetchPhotos")}
            </Button>
          )}
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
            {t("nearby.addPlace")}
          </Button>
        </div>
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
          title={t("nearby.noPlaces")}
          description={t("nearby.noPlacesHostDesc")}
          action={
            <Button onClick={openAddModal} size="sm">
              {t("nearby.addPlace")}
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
                    {t("nearby.viewMap")}
                  </a>
                )}
              </div>

              <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditModal(place)}
                >
                  {t("common.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeletePlace(place.id)}
                  loading={deletingId === place.id}
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  {t("common.delete")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Guest Recommendations */}
      {recommendations.filter((r) => r.status === "pending").length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            {t("recommend.guestPick")}
            <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-sm text-rose-600">
              {recommendations.filter((r) => r.status === "pending").length}
            </span>
          </h2>
          <div className="space-y-3">
            {recommendations
              .filter((r) => r.status === "pending")
              .map((rec) => (
                <Card key={rec.id} className="border-rose-100 bg-rose-50/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">{rec.name}</h3>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          {categories.find((c) => c.key === rec.category)?.label ?? rec.category}
                        </span>
                      </div>
                      {rec.description && (
                        <p className="mt-1 text-sm text-gray-500">{rec.description}</p>
                      )}
                      {rec.address && (
                        <p className="mt-1 text-xs text-gray-400">{rec.address}</p>
                      )}
                      {rec.show_recommender && rec.recommender_name && (
                        <p className="mt-1 text-xs text-gray-400">
                          {rec.recommender_name} {rec.recommender_country ?? ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2 border-t border-rose-100 pt-3">
                    <Button
                      size="sm"
                      onClick={() => handleApproveRec(rec)}
                    >
                      {t("guest.approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditRec(rec)}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRejectRec(rec.id)}
                      className="text-red-500 hover:bg-red-50 hover:text-red-600"
                    >
                      {t("guest.reject")}
                    </Button>
                  </div>
                </Card>
              ))}
          </div>
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingPlace ? t("nearby.editPlace") : editingRec ? t("nearby.editPlace") : t("nearby.addPlace")}
      >
        <NearbyPlaceForm
          key={editingPlace?.id ?? editingRec?.id ?? "new"}
          initialData={editingPlace ?? (editingRec ? {
            name: editingRec.name,
            category: editingRec.category,
            description: editingRec.description,
            address: editingRec.address,
            map_url: editingRec.map_url,
            photo_url: editingRec.photo_url,
          } : undefined)}
          onSubmit={editingPlace ? handleEditPlace : editingRec ? handleSubmitRec : handleAddPlace}
          onCancel={closeModal}
          isLoading={isSubmitting}
        />
      </Modal>
    </div>
  );
}

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PropertyForm } from "@/components/property/PropertyForm";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Property } from "@/types/database";

export default function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    async function fetchProperty() {
      setIsFetching(true);
      const { data, error: fetchError } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !data) {
        setError("숙소를 찾을 수 없습니다.");
      } else {
        setProperty(data as Property);
      }
      setIsFetching(false);
    }

    fetchProperty();
  }, [id]);

  async function handleSubmit(formData: {
    name: string;
    description: string;
    address: string;
    wifi_ssid: string;
    wifi_password: string;
    checkin_guide: string;
    checkout_guide: string;
    house_rules: string;
    photos: File[];
  }) {
    setIsLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("로그인이 필요합니다.");
        return;
      }

      let photoUrls = property?.photos ?? [];

      if (formData.photos.length > 0) {
        const newPhotoUrls: string[] = [];
        for (const photo of formData.photos) {
          const fileExt = photo.name.split(".").pop();
          const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("property-photos")
            .upload(filePath, photo);

          if (uploadError) {
            console.error("Photo upload error:", uploadError);
            continue;
          }

          const {
            data: { publicUrl },
          } = supabase.storage
            .from("property-photos")
            .getPublicUrl(filePath);

          newPhotoUrls.push(publicUrl);
        }
        photoUrls = [...(photoUrls ?? []), ...newPhotoUrls];
      }

      const { error: updateError } = await supabase
        .from("properties")
        .update({
          name: formData.name,
          description: formData.description || null,
          address: formData.address || null,
          photos: photoUrls.length > 0 ? photoUrls : null,
          wifi_ssid: formData.wifi_ssid || null,
          wifi_password: formData.wifi_password || null,
          checkin_guide: formData.checkin_guide || null,
          checkout_guide: formData.checkout_guide || null,
          house_rules: formData.house_rules || null,
        })
        .eq("id", id);

      if (updateError) {
        setError("숙소 수정에 실패했습니다. 다시 시도해주세요.");
        console.error("Update error:", updateError);
        return;
      }

      router.push("/host");
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("예상치 못한 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("properties")
        .delete()
        .eq("id", id);

      if (deleteError) {
        setError("숙소 삭제에 실패했습니다. 다시 시도해주세요.");
        console.error("Delete error:", deleteError);
        setIsDeleting(false);
        return;
      }

      router.push("/host");
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("예상치 못한 오류가 발생했습니다.");
      setIsDeleting(false);
    }
  }

  if (isFetching) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "숙소를 찾을 수 없습니다."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">숙소 정보 수정</h1>
        <p className="mt-1 text-sm text-gray-500">
          숙소 정보를 수정하세요.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <PropertyForm
          initialData={property}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </Card>

      <div className="mt-8 border-t border-gray-200 pt-8">
        <h2 className="text-lg font-semibold text-red-600">위험 영역</h2>
        <p className="mt-1 text-sm text-gray-500">
          이 작업은 되돌릴 수 없습니다. 모든 관련 데이터가 함께 삭제됩니다.
        </p>

        {showDeleteConfirm ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">
              정말로 이 숙소를 삭제하시겠습니까?
            </p>
            <div className="mt-3 flex gap-3">
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                loading={isDeleting}
              >
                삭제하기
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                취소
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="danger"
            className="mt-4"
            onClick={() => setShowDeleteConfirm(true)}
          >
            숙소 삭제
          </Button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PropertyForm, type PropertyFormData } from "@/components/property/PropertyForm";
import { removePhotoByUrl, uploadMainPhoto } from "@/lib/propertyPhoto";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useI18n } from "@/lib/i18n/context";
import type { Property } from "@/types/database";

export default function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchProperty() {
      setIsFetching(true);
      const { data, error: fetchError } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !data) {
        setError(t("host.propertyNotFound"));
      } else {
        setProperty(data as Property);
      }
      setIsFetching(false);
    }

    fetchProperty();
  }, [id]);

  async function handleSubmit(formData: PropertyFormData) {
    setIsLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError(t("common.loginRequired"));
        return;
      }

      // 메인 이미지: 지웠거나 교체했으면 기존 파일 삭제, 새 파일은 업로드
      await removePhotoByUrl(supabase, formData.removedPhoto);
      const uploaded = formData.mainPhoto ? await uploadMainPhoto(supabase, user.id, formData.mainPhoto) : null;
      const mainUrl = uploaded ?? formData.existingPhoto;

      const { error: updateError } = await supabase
        .from("properties")
        .update({
          name: formData.name,
          airbnb_listing_title: formData.airbnb_listing_title || null,
          address: formData.address || null,
          photos: mainUrl ? [mainUrl] : null,
          wifi_ssid: formData.wifi_ssid || null,
          wifi_password: formData.wifi_password || null,
          checkin_time: formData.checkin_time || null,
          checkout_time: formData.checkout_time || null,
          checkin_guide: formData.checkin_guide || null,
          checkout_guide: formData.checkout_guide || null,
          house_rules: formData.house_rules || null,
        })
        .eq("id", id);

      if (updateError) {
        setError(t("host.updateFailed"));
        console.error("Update error:", updateError);
        return;
      }

      router.push("/host");
    } catch (err) {
      console.error("Unexpected error:", err);
      setError(t("common.unexpectedError"));
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
        setError(t("host.deleteFailed"));
        console.error("Delete error:", deleteError);
        setIsDeleting(false);
        return;
      }

      router.push("/host");
    } catch (err) {
      console.error("Unexpected error:", err);
      setError(t("common.unexpectedError"));
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
          {error || t("host.propertyNotFound")}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-gray-900">숙소 정보</h1>

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

      <div className="mt-10 text-center">
        <button
          type="button"
          onClick={async () => {
            if (!confirm("이 숙소를 삭제할까요? 규칙과 수신 메시지도 함께 삭제되며 되돌릴 수 없습니다.")) return;
            await handleDelete();
          }}
          disabled={isDeleting}
          className="text-xs text-gray-400 underline-offset-2 hover:text-red-500 hover:underline disabled:opacity-50"
        >
          {isDeleting ? "삭제 중..." : "숙소 삭제"}
        </button>
      </div>
    </div>
  );
}

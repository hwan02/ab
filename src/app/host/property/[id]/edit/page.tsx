"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PropertyForm } from "@/components/property/PropertyForm";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
        setError(t("host.propertyNotFound"));
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
        setError(t("common.loginRequired"));
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("host.editProperty")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("host.editPropertyDesc")}
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
        <h2 className="text-lg font-semibold text-red-600">{t("host.dangerZone")}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {t("host.deleteWarning")}
        </p>

        {showDeleteConfirm ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">
              {t("host.deleteConfirm")}
            </p>
            <div className="mt-3 flex gap-3">
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                loading={isDeleting}
              >
                {t("host.confirmDelete")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="danger"
            className="mt-4"
            onClick={() => setShowDeleteConfirm(true)}
          >
            {t("host.deleteProperty")}
          </Button>
        )}
      </div>
    </div>
  );
}

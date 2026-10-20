"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PropertyForm, type PropertyFormData } from "@/components/property/PropertyForm";
import { Card } from "@/components/ui/Card";
import { useI18n } from "@/lib/i18n/context";
import { uploadMainPhoto } from "@/lib/propertyPhoto";

export default function NewPropertyPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(data: PropertyFormData) {
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

      const mainUrl = data.mainPhoto ? await uploadMainPhoto(supabase, user.id, data.mainPhoto) : null;

      const { data: inserted, error: insertError } = await supabase
        .from("properties")
        .insert({
          host_id: user.id,
          name: data.name,
          airbnb_listing_title: data.airbnb_listing_title || null,
          address: data.address || null,
          photos: mainUrl ? [mainUrl] : null,
          wifi_ssid: data.wifi_ssid || null,
          wifi_password: data.wifi_password || null,
          checkin_time: data.checkin_time || null,
          checkout_time: data.checkout_time || null,
          checkin_guide: data.checkin_guide || null,
          checkout_guide: data.checkout_guide || null,
          house_rules: data.house_rules || null,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        setError(t("host.registerFailed"));
        console.error("Insert error:", insertError);
        return;
      }

      // 등록 직후 자동응답 규칙 화면으로 안내
      router.push(`/host/property/${inserted.id}/rules`);
    } catch (err) {
      console.error("Unexpected error:", err);
      setError(t("common.unexpectedError"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("host.newProperty")}</h1>
        <p className="mt-1 text-sm text-gray-500">게스트 메시지에 답할 때 필요한 정보만 입력하면 됩니다. 등록 후 자동응답 규칙을 설정합니다.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <Card>
        <PropertyForm onSubmit={handleSubmit} isLoading={isLoading} />
      </Card>
    </div>
  );
}

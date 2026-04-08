"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PropertyForm } from "@/components/property/PropertyForm";
import { Card } from "@/components/ui/Card";

export default function NewPropertyPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(data: {
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

      const photoUrls: string[] = [];

      if (data.photos.length > 0) {
        for (const photo of data.photos) {
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

          photoUrls.push(publicUrl);
        }
      }

      const { error: insertError } = await supabase
        .from("properties")
        .insert({
          host_id: user.id,
          name: data.name,
          description: data.description || null,
          address: data.address || null,
          photos: photoUrls.length > 0 ? photoUrls : null,
          wifi_ssid: data.wifi_ssid || null,
          wifi_password: data.wifi_password || null,
          checkin_guide: data.checkin_guide || null,
          checkout_guide: data.checkout_guide || null,
          house_rules: data.house_rules || null,
        });

      if (insertError) {
        setError("숙소 등록에 실패했습니다. 다시 시도해주세요.");
        console.error("Insert error:", insertError);
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">새 숙소 등록</h1>
        <p className="mt-1 text-sm text-gray-500">
          숙소 정보를 입력하고 등록하세요.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <PropertyForm onSubmit={handleSubmit} isLoading={isLoading} />
      </Card>
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { nearbyPlaceFormSchema, getFieldErrors } from "@/lib/validations";
import type { NearbyPlace } from "@/types/database";

interface NearbyPlaceFormProps {
  initialData?: Partial<NearbyPlace>;
  onSubmit: (data: {
    name: string;
    description: string;
    address: string;
    category: NearbyPlace["category"];
    phone: string;
    map_url: string;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

function NearbyPlaceForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: NearbyPlaceFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [address, setAddress] = useState(initialData?.address ?? "");
  const [category, setCategory] = useState<NearbyPlace["category"]>(
    initialData?.category ?? "attraction"
  );
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [mapUrl, setMapUrl] = useState(initialData?.map_url ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categoryOptions = [
    { value: "attraction", label: t("nearby.attraction") },
    { value: "restaurant", label: t("nearby.restaurant") },
    { value: "convenience", label: t("nearby.convenience") },
    { value: "experience", label: t("nearby.experience") },
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const result = nearbyPlaceFormSchema.safeParse({
      name,
      description,
      address,
      category,
      phone,
      map_url: mapUrl,
    });

    if (!result.success) {
      const fieldErrors = getFieldErrors(result.error);
      const translated: Record<string, string> = {};
      for (const [key, msg] of Object.entries(fieldErrors)) {
        translated[key] = t(msg as Parameters<typeof t>[0]);
      }
      setErrors(translated);
      return;
    }

    setErrors({});
    await onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t("nearbyForm.nameLabel")}
        placeholder={t("nearbyForm.namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        disabled={isLoading}
      />

      <Textarea
        label={t("nearbyForm.descLabel")}
        placeholder={t("nearbyForm.descPlaceholder")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        disabled={isLoading}
      />

      <Input
        label={t("nearbyForm.addressLabel")}
        placeholder={t("nearbyForm.addressPlaceholder")}
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        disabled={isLoading}
      />

      <Select
        label={t("nearbyForm.categoryLabel")}
        options={categoryOptions}
        value={category}
        onChange={(e) =>
          setCategory(e.target.value as NearbyPlace["category"])
        }
        disabled={isLoading}
      />

      <Input
        label={t("nearbyForm.phoneLabel")}
        placeholder={t("nearbyForm.phonePlaceholder")}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={isLoading}
      />

      <Input
        label={t("nearbyForm.mapUrlLabel")}
        placeholder={t("nearbyForm.mapUrlPlaceholder")}
        value={mapUrl}
        onChange={(e) => setMapUrl(e.target.value)}
        disabled={isLoading}
      />

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={isLoading}>
          {initialData ? t("common.update") : t("common.add")}
        </Button>
      </div>
    </form>
  );
}

export { NearbyPlaceForm, type NearbyPlaceFormProps };

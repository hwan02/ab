"use client";

import { useState, useCallback, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import PlaceAutocomplete from "@/components/maps/PlaceAutocomplete";
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
    latitude?: number;
    longitude?: number;
    google_place_id?: string;
    photo_url?: string;
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
  const [latitude, setLatitude] = useState<number | undefined>(
    initialData?.latitude ?? undefined
  );
  const [longitude, setLongitude] = useState<number | undefined>(
    initialData?.longitude ?? undefined
  );
  const [googlePlaceId, setGooglePlaceId] = useState(
    initialData?.google_place_id ?? ""
  );
  const [photoUrl, setPhotoUrl] = useState(initialData?.photo_url ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categoryOptions = [
    { value: "attraction", label: t("nearby.attraction") },
    { value: "restaurant", label: t("nearby.restaurant") },
    { value: "convenience", label: t("nearby.convenience") },
    { value: "experience", label: t("nearby.experience") },
  ];

  const handlePlaceSelect = useCallback(
    (result: {
      name: string;
      address: string;
      latitude: number;
      longitude: number;
      phone: string;
      mapUrl: string;
      googlePlaceId: string;
      photoUrl: string;
    }) => {
      setName(result.name);
      setAddress(result.address);
      setLatitude(result.latitude);
      setLongitude(result.longitude);
      setPhone(result.phone);
      setMapUrl(result.mapUrl);
      setGooglePlaceId(result.googlePlaceId);
      setPhotoUrl(result.photoUrl);
    },
    []
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const result = nearbyPlaceFormSchema.safeParse({
      name,
      description,
      address,
      category,
      phone,
      map_url: mapUrl,
      latitude,
      longitude,
      google_place_id: googlePlaceId,
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
    await onSubmit({
      ...result.data,
      latitude: result.data.latitude,
      longitude: result.data.longitude,
      google_place_id: result.data.google_place_id,
      photo_url: photoUrl || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PlaceAutocomplete
        label={t("nearbyForm.nameLabel")}
        placeholder={t("nearbyForm.namePlaceholder")}
        value={name}
        onChange={setName}
        onPlaceSelect={handlePlaceSelect}
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

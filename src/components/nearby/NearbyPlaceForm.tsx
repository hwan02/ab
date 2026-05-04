"use client";

import { useState, useCallback, useRef, type FormEvent } from "react";
import Image from "next/image";
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
    photo_file?: File;
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      photo_file: photoFile || undefined,
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

      {/* Photo Upload */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          {t("nearbyForm.photoLabel")}
        </label>
        {(photoPreview || photoUrl) ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            <Image
              src={photoPreview || photoUrl}
              alt=""
              fill
              className="object-cover"
              unoptimized={!!photoPreview}
            />
            <button
              type="button"
              onClick={() => {
                setPhotoFile(null);
                setPhotoPreview(null);
                setPhotoUrl("");
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-8 text-gray-400 transition-colors hover:border-rose-300 hover:text-rose-500"
          >
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
            <span className="text-sm font-medium">{t("nearbyForm.uploadPhoto")}</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
          }}
        />
      </div>

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

"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { propertyFormSchema, getFieldErrors } from "@/lib/validations";
import type { Property } from "@/types/database";

interface PropertyFormProps {
  initialData?: Partial<Property>;
  onSubmit: (data: {
    name: string;
    description: string;
    address: string;
    wifi_ssid: string;
    wifi_password: string;
    checkin_guide: string;
    checkout_guide: string;
    house_rules: string;
    photos: File[];
  }) => Promise<void>;
  isLoading: boolean;
}

function PropertyForm({ initialData, onSubmit, isLoading }: PropertyFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [address, setAddress] = useState(initialData?.address ?? "");
  const [wifiSsid, setWifiSsid] = useState(initialData?.wifi_ssid ?? "");
  const [wifiPassword, setWifiPassword] = useState(
    initialData?.wifi_password ?? ""
  );
  const [checkinGuide, setCheckinGuide] = useState(
    initialData?.checkin_guide ?? ""
  );
  const [checkoutGuide, setCheckoutGuide] = useState(
    initialData?.checkout_guide ?? ""
  );
  const [houseRules, setHouseRules] = useState(
    initialData?.house_rules ?? ""
  );
  const [photos, setPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setPhotos(Array.from(e.target.files));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const result = propertyFormSchema.safeParse({
      name,
      description,
      address,
      wifi_ssid: wifiSsid,
      wifi_password: wifiPassword,
      checkin_guide: checkinGuide,
      checkout_guide: checkoutGuide,
      house_rules: houseRules,
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
    await onSubmit({ ...result.data, photos });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label={t("propertyForm.nameLabel")}
        placeholder={t("propertyForm.namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        disabled={isLoading}
      />

      <Textarea
        label={t("propertyForm.descLabel")}
        placeholder={t("propertyForm.descPlaceholder")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        disabled={isLoading}
      />

      <Input
        label={t("propertyForm.addressLabel")}
        placeholder={t("propertyForm.addressPlaceholder")}
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        disabled={isLoading}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Wi-Fi SSID"
          placeholder={t("propertyForm.wifiSsidPlaceholder")}
          value={wifiSsid}
          onChange={(e) => setWifiSsid(e.target.value)}
          disabled={isLoading}
        />
        <Input
          label={t("propertyForm.wifiPasswordLabel")}
          placeholder={t("propertyForm.wifiPasswordLabel")}
          value={wifiPassword}
          onChange={(e) => setWifiPassword(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <Textarea
        label={t("propertyForm.checkinLabel")}
        placeholder={t("propertyForm.checkinPlaceholder")}
        value={checkinGuide}
        onChange={(e) => setCheckinGuide(e.target.value)}
        rows={3}
        disabled={isLoading}
      />

      <Textarea
        label={t("propertyForm.checkoutLabel")}
        placeholder={t("propertyForm.checkoutPlaceholder")}
        value={checkoutGuide}
        onChange={(e) => setCheckoutGuide(e.target.value)}
        rows={3}
        disabled={isLoading}
      />

      <Textarea
        label={t("propertyForm.rulesLabel")}
        placeholder={t("propertyForm.rulesPlaceholder")}
        value={houseRules}
        onChange={(e) => setHouseRules(e.target.value)}
        rows={4}
        disabled={isLoading}
      />

      <div className="w-full">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          {t("propertyForm.photosLabel")}
        </label>
        {initialData?.photos && initialData.photos.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {initialData.photos.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`${t("propertyForm.photoAlt")} ${i + 1}`}
                className="h-20 w-20 rounded-lg object-cover border border-gray-200"
              />
            ))}
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoChange}
          disabled={isLoading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-rose-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-rose-600 hover:file:bg-rose-100 disabled:opacity-50"
        />
        {photos.length > 0 && (
          <p className="mt-1.5 text-sm text-gray-500">
            {photos.length}{t("common.filesSelected")}
          </p>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" loading={isLoading}>
          {initialData ? t("common.save") : t("common.register")}
        </Button>
      </div>
    </form>
  );
}

export { PropertyForm, type PropertyFormProps };

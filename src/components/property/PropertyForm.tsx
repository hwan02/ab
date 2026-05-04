"use client";

import { useState, useRef, useCallback, type FormEvent, type ChangeEvent, type DragEvent } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { propertyFormSchema, getFieldErrors } from "@/lib/validations";
import type { Property } from "@/types/database";

type ManagedPhoto =
  | { type: "existing"; url: string }
  | { type: "new"; file: File; preview: string };

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
    existingPhotos: string[];
    deletedPhotos: string[];
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Photo management
  const initialPhotos: ManagedPhoto[] = (initialData?.photos ?? []).map(
    (url) => ({ type: "existing" as const, url })
  );
  const [managedPhotos, setManagedPhotos] = useState<ManagedPhoto[]>(initialPhotos);
  const [deletedPhotos, setDeletedPhotos] = useState<string[]>([]);
  const dragIndexRef = useRef<number | null>(null);

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const newPhotos: ManagedPhoto[] = Array.from(e.target.files).map(
        (file) => ({
          type: "new" as const,
          file,
          preview: URL.createObjectURL(file),
        })
      );
      setManagedPhotos((prev) => [...prev, ...newPhotos]);
      e.target.value = "";
    }
  }

  function removePhoto(index: number) {
    setManagedPhotos((prev) => {
      const photo = prev[index];
      if (photo.type === "existing") {
        setDeletedPhotos((d) => [...d, photo.url]);
      } else {
        URL.revokeObjectURL(photo.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  function movePhoto(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= managedPhotos.length) return;
    setManagedPhotos((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index;
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, dropIndex: number) => {
      e.preventDefault();
      const dragIndex = dragIndexRef.current;
      if (dragIndex === null || dragIndex === dropIndex) return;
      movePhoto(dragIndex, dropIndex);
      dragIndexRef.current = null;
    },
    [managedPhotos.length]
  );

  function getPhotoSrc(photo: ManagedPhoto): string {
    return photo.type === "existing" ? photo.url : photo.preview;
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

    const existingPhotos = managedPhotos
      .filter((p): p is ManagedPhoto & { type: "existing" } => p.type === "existing")
      .map((p) => p.url);

    const newPhotos = managedPhotos
      .filter((p): p is ManagedPhoto & { type: "new" } => p.type === "new")
      .map((p) => p.file);

    await onSubmit({
      ...result.data,
      photos: newPhotos,
      existingPhotos,
      deletedPhotos,
    });
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
        {managedPhotos.length > 0 && (
          <p className="mb-2 text-xs text-gray-400">
            {t("propertyForm.dragToReorder")}
          </p>
        )}
        {managedPhotos.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {managedPhotos.map((photo, i) => (
              <div
                key={photo.type === "existing" ? photo.url : photo.preview}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, i)}
                className="group relative aspect-square cursor-grab active:cursor-grabbing"
              >
                <img
                  src={getPhotoSrc(photo)}
                  alt={`${t("propertyForm.photoAlt")} ${i + 1}`}
                  className="h-full w-full rounded-lg object-cover border border-gray-200"
                />
                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  disabled={isLoading}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 disabled:opacity-50"
                  aria-label={t("propertyForm.deletePhoto")}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
                {/* Mobile move buttons */}
                <div className="absolute bottom-1 left-1 flex gap-0.5 sm:hidden">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => movePhoto(i, i - 1)}
                      disabled={isLoading}
                      className="flex h-6 w-6 items-center justify-center rounded bg-black/50 text-white"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                  )}
                  {i < managedPhotos.length - 1 && (
                    <button
                      type="button"
                      onClick={() => movePhoto(i, i + 1)}
                      disabled={isLoading}
                      className="flex h-6 w-6 items-center justify-center rounded bg-black/50 text-white"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  )}
                </div>
                {/* Order badge */}
                <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[10px] font-medium text-white">
                  {i + 1}
                </span>
              </div>
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

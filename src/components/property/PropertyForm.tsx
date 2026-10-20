"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { propertyFormSchema, getFieldErrors } from "@/lib/validations";
import { looksLikeHashtagTitle } from "@/lib/airbnb/sync";
import type { Property } from "@/types/database";

/** 번역표에 없는 검증 메시지. 호스트 화면은 한국어라 여기서 바로 보여 준다. */
const LOCAL_MESSAGES: Record<string, string> = {
  "propertyForm.listingTitleRequired": "에어비앤비 리스팅 제목을 입력해주세요. 이 제목으로 알림 메일의 숙소를 찾습니다.",
};

/**
 * 숙소 등록/수정 폼.
 * 게스트 메시지 자동응답에 필요한 항목만 보여 준다. 소개글, 다국어 번역, 사진 여러 장 같은 나머지는 숨기고
 * (DB 값은 그대로 둔다), 사진은 메인 이미지 한 장만 받는다.
 */

export interface PropertyFormData {
  name: string;
  airbnb_listing_title: string;
  address: string;
  wifi_ssid: string;
  wifi_password: string;
  checkin_time: string;
  checkout_time: string;
  checkin_guide: string;
  checkout_guide: string;
  house_rules: string;
  /** 새로 고른 메인 이미지. 없으면 null. */
  mainPhoto: File | null;
  /** 기존 메인 이미지 URL. 지웠거나 없으면 null. */
  existingPhoto: string | null;
  /** 기존 메인 이미지를 지웠는지 (교체 포함). */
  removedPhoto: string | null;
}

interface PropertyFormProps {
  initialData?: Partial<Property>;
  onSubmit: (data: PropertyFormData) => Promise<void>;
  isLoading: boolean;
}

function PropertyForm({ initialData, onSubmit, isLoading }: PropertyFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initialData?.name ?? "");
  const [listingTitle, setListingTitle] = useState(initialData?.airbnb_listing_title ?? "");
  const [address, setAddress] = useState(initialData?.address ?? "");
  const [wifiSsid, setWifiSsid] = useState(initialData?.wifi_ssid ?? "");
  const [wifiPassword, setWifiPassword] = useState(initialData?.wifi_password ?? "");
  const [checkinTime, setCheckinTime] = useState(initialData?.checkin_time ?? "");
  const [checkoutTime, setCheckoutTime] = useState(initialData?.checkout_time ?? "");
  const [checkinGuide, setCheckinGuide] = useState(initialData?.checkin_guide ?? "");
  const [checkoutGuide, setCheckoutGuide] = useState(initialData?.checkout_guide ?? "");
  const [houseRules, setHouseRules] = useState(initialData?.house_rules ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const initialPhoto = initialData?.photos?.[0] ?? null;
  const [existingPhoto, setExistingPhoto] = useState<string | null>(initialPhoto);
  const [removedPhoto, setRemovedPhoto] = useState<string | null>(null);
  const [mainPhoto, setMainPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setMainPhoto(file);
    setPreview(URL.createObjectURL(file));
    if (existingPhoto) {
      setRemovedPhoto(existingPhoto);
      setExistingPhoto(null);
    }
    e.target.value = "";
  }

  function removePhoto() {
    if (preview) URL.revokeObjectURL(preview);
    setMainPhoto(null);
    setPreview(null);
    if (existingPhoto) {
      setRemovedPhoto(existingPhoto);
      setExistingPhoto(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const result = propertyFormSchema.safeParse({
      name,
      airbnb_listing_title: listingTitle,
      address,
      wifi_ssid: wifiSsid,
      wifi_password: wifiPassword,
      checkin_time: checkinTime,
      checkout_time: checkoutTime,
      checkin_guide: checkinGuide,
      checkout_guide: checkoutGuide,
      house_rules: houseRules,
    });

    if (!result.success) {
      const fieldErrors = getFieldErrors(result.error);
      const translated: Record<string, string> = {};
      for (const [key, msg] of Object.entries(fieldErrors)) {
        translated[key] = LOCAL_MESSAGES[msg] ?? t(msg as Parameters<typeof t>[0]);
      }
      setErrors(translated);
      return;
    }
    setErrors({});

    await onSubmit({ ...result.data, mainPhoto, existingPhoto, removedPhoto });
  }

  const shownPhoto = preview ?? existingPhoto;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 메인 이미지 */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">메인 이미지</label>
        <div className="flex items-start gap-4">
          <div className="relative h-28 w-40 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            {shownPhoto ? (
              <img src={shownPhoto} alt="메인 이미지" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-300">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                </svg>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              disabled={isLoading}
              className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-rose-600 hover:file:bg-rose-100 disabled:opacity-50"
            />
            {shownPhoto && (
              <button type="button" onClick={removePhoto} disabled={isLoading} className="text-xs text-gray-500 hover:text-red-600">
                이미지 제거
              </button>
            )}
            <p className="text-xs text-gray-400">한 장만 등록됩니다. 숙소 목록과 게스트 화면에 표시됩니다.</p>
          </div>
        </div>
      </div>

      <Input
        label={t("propertyForm.nameLabel")}
        placeholder={t("propertyForm.namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        disabled={isLoading}
      />

      <div>
        <Input
          label="에어비앤비 리스팅 제목 *"
          placeholder="#홍대입구역 #최대6인 #짐보관서비스 ... (에어비앤비에 올린 제목 그대로)"
          value={listingTitle}
          onChange={(e) => setListingTitle(e.target.value)}
          error={errors.airbnb_listing_title}
          disabled={isLoading}
        />
        {listingTitle.trim() && !looksLikeHashtagTitle(listingTitle) ? (
          <p className="mt-1 text-xs text-amber-600">
            에어비앤비 리스팅 제목은 보통 &quot;#홍대입구역 #최대6인 …&quot; 처럼 해시태그로 시작합니다. 에어비앤비에 올린 제목을 그대로 붙여 넣었는지
            확인해 주세요. 제목이 다르면 이 숙소의 메시지를 찾지 못합니다.
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray-400">
            에어비앤비 알림 메일에 적힌 숙소 제목과 맞춰 이 숙소의 메시지를 찾습니다. 에어비앤비 리스팅 제목을 복사해 붙여 주세요. 숙소가
            여러 개면 제목이 서로 달라야 합니다.
          </p>
        )}
      </div>

      <Input
        label={t("propertyForm.addressLabel")}
        placeholder={t("propertyForm.addressPlaceholder")}
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        disabled={isLoading}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Wi-Fi 이름"
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="체크인 시간" placeholder="오후 3:00" value={checkinTime} onChange={(e) => setCheckinTime(e.target.value)} disabled={isLoading} />
        <Input label="체크아웃 시간" placeholder="오전 11:00" value={checkoutTime} onChange={(e) => setCheckoutTime(e.target.value)} disabled={isLoading} />
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

      <div className="flex justify-end pt-4">
        <Button type="submit" loading={isLoading}>
          {initialData ? t("common.save") : t("common.register")}
        </Button>
      </div>
    </form>
  );
}

export { PropertyForm, type PropertyFormProps };

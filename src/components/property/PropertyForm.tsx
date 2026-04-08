"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
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
  const [nameError, setNameError] = useState("");

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setPhotos(Array.from(e.target.files));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setNameError("");

    if (!name.trim()) {
      setNameError("숙소 이름을 입력해주세요.");
      return;
    }

    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      address: address.trim(),
      wifi_ssid: wifiSsid.trim(),
      wifi_password: wifiPassword.trim(),
      checkin_guide: checkinGuide.trim(),
      checkout_guide: checkoutGuide.trim(),
      house_rules: houseRules.trim(),
      photos,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label="숙소 이름 *"
        placeholder="숙소 이름을 입력하세요"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={nameError}
        disabled={isLoading}
      />

      <Textarea
        label="숙소 설명"
        placeholder="숙소에 대한 설명을 입력하세요"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        disabled={isLoading}
      />

      <Input
        label="주소"
        placeholder="숙소 주소를 입력하세요"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        disabled={isLoading}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Wi-Fi SSID"
          placeholder="Wi-Fi 네트워크 이름"
          value={wifiSsid}
          onChange={(e) => setWifiSsid(e.target.value)}
          disabled={isLoading}
        />
        <Input
          label="Wi-Fi 비밀번호"
          placeholder="Wi-Fi 비밀번호"
          value={wifiPassword}
          onChange={(e) => setWifiPassword(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <Textarea
        label="체크인 안내"
        placeholder="체크인 방법을 안내해주세요"
        value={checkinGuide}
        onChange={(e) => setCheckinGuide(e.target.value)}
        rows={3}
        disabled={isLoading}
      />

      <Textarea
        label="체크아웃 안내"
        placeholder="체크아웃 방법을 안내해주세요"
        value={checkoutGuide}
        onChange={(e) => setCheckoutGuide(e.target.value)}
        rows={3}
        disabled={isLoading}
      />

      <Textarea
        label="하우스 룰"
        placeholder="숙소 이용 규칙을 입력하세요"
        value={houseRules}
        onChange={(e) => setHouseRules(e.target.value)}
        rows={4}
        disabled={isLoading}
      />

      <div className="w-full">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          숙소 사진
        </label>
        {initialData?.photos && initialData.photos.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {initialData.photos.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`숙소 사진 ${i + 1}`}
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
            {photos.length}개 파일 선택됨
          </p>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" loading={isLoading}>
          {initialData ? "저장하기" : "등록하기"}
        </Button>
      </div>
    </form>
  );
}

export { PropertyForm, type PropertyFormProps };

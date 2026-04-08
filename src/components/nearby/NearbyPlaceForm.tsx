"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
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

const categoryOptions = [
  { value: "attraction", label: "볼거리" },
  { value: "restaurant", label: "먹거리" },
  { value: "convenience", label: "편의시설" },
  { value: "experience", label: "체험" },
];

function NearbyPlaceForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: NearbyPlaceFormProps) {
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
  const [nameError, setNameError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setNameError("");

    if (!name.trim()) {
      setNameError("장소 이름을 입력해주세요.");
      return;
    }

    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      address: address.trim(),
      category,
      phone: phone.trim(),
      map_url: mapUrl.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="장소 이름 *"
        placeholder="장소 이름을 입력하세요"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={nameError}
        disabled={isLoading}
      />

      <Textarea
        label="설명"
        placeholder="장소에 대한 설명을 입력하세요"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        disabled={isLoading}
      />

      <Input
        label="주소"
        placeholder="장소 주소를 입력하세요"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        disabled={isLoading}
      />

      <Select
        label="카테고리"
        options={categoryOptions}
        value={category}
        onChange={(e) =>
          setCategory(e.target.value as NearbyPlace["category"])
        }
        disabled={isLoading}
      />

      <Input
        label="전화번호"
        placeholder="전화번호를 입력하세요"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={isLoading}
      />

      <Input
        label="지도 URL"
        placeholder="네이버 지도 또는 카카오맵 링크"
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
          취소
        </Button>
        <Button type="submit" loading={isLoading}>
          {initialData ? "수정하기" : "추가하기"}
        </Button>
      </div>
    </form>
  );
}

export { NearbyPlaceForm, type NearbyPlaceFormProps };

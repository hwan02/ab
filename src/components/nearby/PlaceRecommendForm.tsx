"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import PlaceAutocomplete from "@/components/maps/PlaceAutocomplete";

interface PlaceRecommendFormProps {
  propertyId: string;
  onClose: () => void;
}

export default function PlaceRecommendForm({ propertyId, onClose }: PlaceRecommendFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("restaurant");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [showRecommender, setShowRecommender] = useState(false);
  const [country, setCountry] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

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
      setMapUrl(result.mapUrl);
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, avatar_url")
      .eq("id", user.id)
      .single();

    let photoUrl: string | null = null;
    if (photoFile) {
      const fileExt = photoFile.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("property-photos")
        .upload(filePath, photoFile);
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from("property-photos")
          .getPublicUrl(filePath);
        photoUrl = publicUrl;
      }
    }

    const { error } = await supabase.from("place_recommendations").insert({
      property_id: propertyId,
      guest_id: user.id,
      name: name.trim(),
      category,
      description: description.trim() || null,
      address: address.trim() || null,
      map_url: mapUrl.trim() || null,
      photo_url: photoUrl,
      show_recommender: showRecommender,
      recommender_name: showRecommender ? (profile?.name ?? null) : null,
      recommender_avatar: showRecommender ? (profile?.avatar_url ?? null) : null,
      recommender_country: showRecommender && country ? country : null,
    });

    setSubmitting(false);

    if (error) {
      alert(t("recommend.failed"));
    } else {
      setSent(true);
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 2000);
    }
  };

  if (sent) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        <svg className="h-5 w-5 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        {t("recommend.sent")}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <PlaceAutocomplete
        label={t("recommend.nameLabel")}
        placeholder={t("recommend.namePlaceholder")}
        value={name}
        onChange={setName}
        onPlaceSelect={handlePlaceSelect}
      />
      <Select
        label={t("recommend.categoryLabel")}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        options={[
          { value: "restaurant", label: t("nearby.restaurant") },
          { value: "attraction", label: t("nearby.attraction") },
          { value: "convenience", label: t("nearby.convenience") },
          { value: "experience", label: t("nearby.experience") },
        ]}
      />
      <Textarea
        label={t("propertyForm.descLabel")}
        placeholder={t("recommend.descPlaceholder")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />
      <Input
        label={t("propertyForm.addressLabel")}
        placeholder={t("recommend.addressPlaceholder")}
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />

      {/* Photo Upload */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          {t("nearbyForm.photoLabel")}
        </label>
        {photoPreview ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            <img src={photoPreview} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => {
                setPhotoFile(null);
                setPhotoPreview(null);
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
            disabled={submitting}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-6 text-gray-400 transition-colors hover:border-rose-300 hover:text-rose-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
            <span className="text-xs font-medium">{t("nearbyForm.uploadPhoto")}</span>
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

      {/* Show recommender toggle */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
        <button
          type="button"
          onClick={() => setShowRecommender(!showRecommender)}
          className="flex w-full items-center justify-between"
        >
          <div>
            <p className="text-left text-sm font-medium text-gray-700">{t("recommend.showProfile")}</p>
            <p className="text-left text-xs text-gray-400">{t("recommend.showProfileDesc")}</p>
          </div>
          <div className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${showRecommender ? "bg-rose-500" : "bg-gray-300"}`}>
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${showRecommender ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
        </button>
        {showRecommender && (
          <div className="mt-2">
            <Select
              label={t("recommend.countryLabel")}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              options={[
                { value: "", label: t("recommend.countrySelect") },
                { value: "🇰🇷 한국", label: "🇰🇷 한국" },
                { value: "🇺🇸 USA", label: "🇺🇸 USA" },
                { value: "🇯🇵 日本", label: "🇯🇵 日本" },
                { value: "🇨🇳 中国", label: "🇨🇳 中国" },
                { value: "🇬🇧 UK", label: "🇬🇧 UK" },
                { value: "🇫🇷 France", label: "🇫🇷 France" },
                { value: "🇩🇪 Deutschland", label: "🇩🇪 Deutschland" },
                { value: "🇪🇸 España", label: "🇪🇸 España" },
                { value: "🇮🇹 Italia", label: "🇮🇹 Italia" },
                { value: "🇹🇭 ไทย", label: "🇹🇭 ไทย" },
                { value: "🇻🇳 Việt Nam", label: "🇻🇳 Việt Nam" },
                { value: "🇮🇩 Indonesia", label: "🇮🇩 Indonesia" },
                { value: "🇵🇭 Philippines", label: "🇵🇭 Philippines" },
                { value: "🇦🇺 Australia", label: "🇦🇺 Australia" },
                { value: "🇨🇦 Canada", label: "🇨🇦 Canada" },
                { value: "🇧🇷 Brasil", label: "🇧🇷 Brasil" },
                { value: "🇮🇳 India", label: "🇮🇳 India" },
                { value: "🌍 Other", label: "🌍 Other" },
              ]}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          {t("common.cancel")}
        </button>
        <Button type="submit" loading={submitting} disabled={!name.trim()}>
          {t("recommend.submit")}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import GoogleMapsProvider from "@/components/maps/GoogleMapsProvider";
import PlaceAutocomplete from "@/components/maps/PlaceAutocomplete";
import { notifySlack } from "@/lib/notifySlack";
import { reservationRequestSchema, getFieldErrors } from "@/lib/validations";

interface ReservationRequestFormProps {
  chatRoomId: string;
  senderId: string;
  onSent: () => void;
}

interface PlaceInfo {
  address: string;
  phone: string;
  mapUrl: string;
  googlePlaceId: string;
}

function ReservationRequestForm({
  chatRoomId,
  senderId,
  onSent,
}: ReservationRequestFormProps) {
  const { t } = useI18n();
  const [restaurantName, setRestaurantName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [specialRequests, setSpecialRequests] = useState("");
  const [placeInfo, setPlaceInfo] = useState<PlaceInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const supabase = createClient();

  const handlePlaceSelect = useCallback(
    (result: { name: string; address: string; phone: string; mapUrl: string; googlePlaceId: string }) => {
      setRestaurantName(result.name);
      setPlaceInfo({
        address: result.address,
        phone: result.phone,
        mapUrl: result.mapUrl,
        googlePlaceId: result.googlePlaceId,
      });
    },
    []
  );

  const handleRestaurantNameChange = useCallback((value: string) => {
    setRestaurantName(value);
    // Clear place info when user manually edits the name
    setPlaceInfo(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = reservationRequestSchema.safeParse({
      restaurantName,
      date,
      time,
      partySize,
      specialRequests,
      address: placeInfo?.address,
      phone: placeInfo?.phone,
      mapUrl: placeInfo?.mapUrl,
      googlePlaceId: placeInfo?.googlePlaceId,
    });

    if (!result.success) {
      const errors = getFieldErrors(result.error);
      const translated: Record<string, string> = {};
      for (const [key, msg] of Object.entries(errors)) {
        translated[key] = t(msg as Parameters<typeof t>[0]);
      }
      setFieldErrors(translated);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    setError(null);

    const content = JSON.stringify(result.data);

    const { error: insertError } = await supabase.from("messages").insert({
      chat_room_id: chatRoomId,
      sender_id: senderId,
      content,
      message_type: "reservation_request",
    });

    if (insertError) {
      setError(t("chat.sendFailed"));
      setSubmitting(false);
      return;
    }

    notifySlack({ messageType: "reservation_request", content });
    setRestaurantName("");
    setDate("");
    setTime("");
    setPartySize("2");
    setSpecialRequests("");
    setPlaceInfo(null);
    setSubmitting(false);
    onSent();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <GoogleMapsProvider>
        <PlaceAutocomplete
          label={t("reservationForm.restaurant")}
          placeholder={t("reservationForm.restaurantPlaceholder")}
          value={restaurantName}
          onChange={handleRestaurantNameChange}
          onPlaceSelect={handlePlaceSelect}
          error={fieldErrors.restaurantName}
        />
      </GoogleMapsProvider>
      {placeInfo?.address && (
        <p className="text-xs text-gray-500">{placeInfo.address}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t("reservationForm.date")}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={fieldErrors.date}
          required
        />
        <Select
          label={t("reservationForm.time")}
          value={time}
          onChange={(e) => setTime(e.target.value)}
          options={[
            { value: "", label: t("reservationForm.timePlaceholder") },
            ...Array.from({ length: 48 }, (_, i) => {
              const h = String(Math.floor(i / 4) + 10).padStart(2, "0");
              const m = ["00", "15", "30", "45"][i % 4];
              return { value: `${h}:${m}`, label: `${h}:${m}` };
            }),
          ]}
        />
      </div>
      <Input
        label={t("reservationForm.partySize")}
        type="number"
        min="1"
        max="20"
        value={partySize}
        onChange={(e) => setPartySize(e.target.value)}
        required
      />
      <Textarea
        label={t("reservationForm.specialRequests")}
        placeholder={t("reservationForm.specialRequestsPlaceholder")}
        value={specialRequests}
        onChange={(e) => setSpecialRequests(e.target.value)}
        rows={2}
        className="min-h-[60px]"
      />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="submit"
          loading={submitting}
          disabled={!restaurantName.trim() || !date || !time}
        >
          {t("reservationForm.submit")}
        </Button>
      </div>
    </form>
  );
}

export { ReservationRequestForm, type ReservationRequestFormProps };

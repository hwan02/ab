"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { reservationRequestSchema, getFieldErrors } from "@/lib/validations";

interface ReservationRequestFormProps {
  chatRoomId: string;
  senderId: string;
  onSent: () => void;
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = reservationRequestSchema.safeParse({
      restaurantName,
      date,
      time,
      partySize,
      specialRequests,
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

    setRestaurantName("");
    setDate("");
    setTime("");
    setPartySize("2");
    setSpecialRequests("");
    setSubmitting(false);
    onSent();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        label={t("reservationForm.restaurant")}
        placeholder={t("reservationForm.restaurantPlaceholder")}
        value={restaurantName}
        onChange={(e) => setRestaurantName(e.target.value)}
        error={fieldErrors.restaurantName}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t("reservationForm.date")}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={fieldErrors.date}
          required
        />
        <Input
          label={t("reservationForm.time")}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          error={fieldErrors.time}
          required
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

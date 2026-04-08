"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

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
  const [restaurantName, setRestaurantName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantName.trim() || !date || !time) return;

    setSubmitting(true);
    setError(null);

    const content = JSON.stringify({
      restaurantName: restaurantName.trim(),
      date,
      time,
      partySize,
      specialRequests: specialRequests.trim(),
    });

    const { error: insertError } = await supabase.from("messages").insert({
      chat_room_id: chatRoomId,
      sender_id: senderId,
      content,
      message_type: "reservation_request",
    });

    if (insertError) {
      setError("요청을 보내지 못했습니다. 다시 시도해주세요.");
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
        label="레스토랑 이름"
        placeholder="예: 스시 오마카세, 한우 맛집"
        value={restaurantName}
        onChange={(e) => setRestaurantName(e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="날짜"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          label="시간"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
        />
      </div>
      <Input
        label="인원"
        type="number"
        min="1"
        max="20"
        value={partySize}
        onChange={(e) => setPartySize(e.target.value)}
        required
      />
      <Textarea
        label="특별 요청사항 (선택)"
        placeholder="알레르기, 좌석 선호도 등"
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
          예약 요청 보내기
        </Button>
      </div>
    </form>
  );
}

export { ReservationRequestForm, type ReservationRequestFormProps };

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

interface ItemRequestFormProps {
  chatRoomId: string;
  senderId: string;
  onSent: () => void;
}

function ItemRequestForm({ chatRoomId, senderId, onSent }: ItemRequestFormProps) {
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [urgency, setUrgency] = useState("보통");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    setSubmitting(true);
    setError(null);

    const content = JSON.stringify({
      itemName: itemName.trim(),
      quantity,
      urgency,
      notes: notes.trim(),
    });

    const { error: insertError } = await supabase.from("messages").insert({
      chat_room_id: chatRoomId,
      sender_id: senderId,
      content,
      message_type: "item_request",
    });

    if (insertError) {
      setError("요청을 보내지 못했습니다. 다시 시도해주세요.");
      setSubmitting(false);
      return;
    }

    setItemName("");
    setQuantity("1");
    setUrgency("보통");
    setNotes("");
    setSubmitting(false);
    onSent();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="물품명"
          placeholder="예: 수건, 칫솔"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          required
        />
        <Input
          label="수량"
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
      </div>
      <Select
        label="긴급도"
        value={urgency}
        onChange={(e) => setUrgency(e.target.value)}
        options={[
          { value: "보통", label: "보통" },
          { value: "급함", label: "급함" },
        ]}
      />
      <Textarea
        label="메모 (선택)"
        placeholder="추가 요청사항을 입력하세요"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="min-h-[60px]"
      />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" loading={submitting} disabled={!itemName.trim()}>
          요청 보내기
        </Button>
      </div>
    </form>
  );
}

export { ItemRequestForm, type ItemRequestFormProps };

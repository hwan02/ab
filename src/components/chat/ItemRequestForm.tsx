"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { itemRequestSchema, getFieldErrors } from "@/lib/validations";

interface ItemRequestFormProps {
  chatRoomId: string;
  senderId: string;
  onSent: () => void;
}

function ItemRequestForm({ chatRoomId, senderId, onSent }: ItemRequestFormProps) {
  const { t } = useI18n();
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [urgency, setUrgency] = useState("보통");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = itemRequestSchema.safeParse({
      itemName,
      quantity,
      urgency,
      notes,
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
      message_type: "item_request",
    });

    if (insertError) {
      setError(t("chat.sendFailed"));
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
          label={t("itemForm.itemName")}
          placeholder={t("itemForm.itemPlaceholder")}
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          error={fieldErrors.itemName}
          required
        />
        <Input
          label={t("itemForm.quantity")}
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
      </div>
      <Select
        label={t("itemForm.urgency")}
        value={urgency}
        onChange={(e) => setUrgency(e.target.value)}
        options={[
          { value: "보통", label: t("itemForm.normal") },
          { value: "급함", label: t("itemForm.urgent") },
        ]}
      />
      <Textarea
        label={t("itemForm.notes")}
        placeholder={t("itemForm.notesPlaceholder")}
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
          {t("itemForm.submit")}
        </Button>
      </div>
    </form>
  );
}

export { ItemRequestForm, type ItemRequestFormProps };

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { notifySlack } from "@/lib/notifySlack";

interface ItemEntry {
  itemName: string;
  quantity: string;
}

interface ItemRequestFormProps {
  chatRoomId: string;
  senderId: string;
  onSent: () => void;
}

function ItemRequestForm({ chatRoomId, senderId }: ItemRequestFormProps) {
  const { t } = useI18n();
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [items, setItems] = useState<ItemEntry[]>([]);
  const [urgency, setUrgency] = useState("보통");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);

  const supabase = createClient();

  const handleAddItem = () => {
    if (!itemName.trim()) return;
    setItems((prev) => [...prev, { itemName: itemName.trim(), quantity }]);
    setItemName("");
    setQuantity("1");
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If there's text in the input, add it first
    const finalItems = [...items];
    if (itemName.trim()) {
      finalItems.push({ itemName: itemName.trim(), quantity });
    }

    if (finalItems.length === 0) return;

    setSubmitting(true);
    setError(null);

    const content = JSON.stringify({
      items: finalItems,
      urgency,
      notes,
    });

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

    notifySlack({ messageType: "item_request", content });
    setSentCount((c) => c + 1);
    setItems([]);
    setItemName("");
    setQuantity("1");
    setUrgency("보통");
    setNotes("");
    setSubmitting(false);
  };

  const totalItems = items.length + (itemName.trim() ? 1 : 0);

  const popularItems = [
    { ko: "생수", en: "Water" },
    { ko: "컵라면", en: "Cup noodle" },
    { ko: "돗자리", en: "Picnic mat" },
    { ko: "헤어핀", en: "Hair pin" },
    { ko: "롤헤어", en: "Hair roller" },
    { ko: "칫솔", en: "Toothbrush" },
    { ko: "충전기", en: "Charger" },
    { ko: "우산", en: "Umbrella" },
  ];

  const handleQuickAdd = (name: string) => {
    setItems((prev) => [...prev, { itemName: name, quantity: "1" }]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Popular items */}
      <div className="flex flex-wrap gap-1.5">
        {popularItems.map((item) => (
          <button
            key={item.ko}
            type="button"
            onClick={() => handleQuickAdd(item.ko)}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
          >
            + {item.ko}
          </button>
        ))}
      </div>

      {/* Item input row */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label={t("itemForm.itemName")}
            placeholder={t("itemForm.itemPlaceholder")}
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddItem();
              }
            }}
          />
        </div>
        <div className="w-20">
          <Input
            label={t("itemForm.quantity")}
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={handleAddItem}
          disabled={!itemName.trim()}
          className="mb-[2px] flex h-10 items-center gap-1 rounded-xl bg-gray-100 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-40"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t("itemForm.addItem")}
        </button>
      </div>

      {/* Item list */}
      {items.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold text-gray-500">
            {t("itemForm.itemList")} ({items.length})
          </p>
          <div className="space-y-1.5">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm"
              >
                <span className="text-gray-900">
                  {item.itemName}{" "}
                  <span className="text-gray-400">
                    x{item.quantity}{t("itemForm.itemCount")}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(idx)}
                  className="rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
      <div className="flex items-center justify-between">
        {sentCount > 0 ? (
          <p className="text-xs text-green-600">
            {`${t("itemForm.sent")} (${sentCount})`}
          </p>
        ) : (
          <span />
        )}
        <Button type="submit" loading={submitting} disabled={totalItems === 0}>
          {t("itemForm.submit")} {totalItems > 0 && `(${totalItems})`}
        </Button>
      </div>
    </form>
  );
}

export { ItemRequestForm, type ItemRequestFormProps };

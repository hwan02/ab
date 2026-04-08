"use client";

import { useState, useEffect, use, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { EmergencyContact } from "@/types/database";

const CATEGORY_OPTIONS = [
  { value: "hospital", label: "병원" },
  { value: "police", label: "경찰" },
  { value: "fire", label: "소방" },
  { value: "host", label: "호스트" },
  { value: "other", label: "기타" },
];

export default function EmergencyContactsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: propertyId } = use(params);
  const supabase = createClient();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingContact, setEditingContact] =
    useState<EmergencyContact | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [name, setName] = useState("");
  const [category, setCategory] =
    useState<EmergencyContact["category"]>("hospital");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    fetchContacts();
  }, [propertyId]);

  async function fetchContacts() {
    setIsFetching(true);
    const { data, error: fetchError } = await supabase
      .from("emergency_contacts")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError("긴급 연락처를 불러오는데 실패했습니다.");
      console.error("Fetch error:", fetchError);
    } else {
      setContacts((data as EmergencyContact[]) ?? []);
    }
    setIsFetching(false);
  }

  function resetForm() {
    setName("");
    setCategory("hospital");
    setPhone("");
    setAddress("");
    setEditingContact(null);
    setFormError("");
    setShowForm(false);
  }

  function startEdit(contact: EmergencyContact) {
    setName(contact.name);
    setCategory(contact.category);
    setPhone(contact.phone);
    setAddress(contact.address ?? "");
    setEditingContact(contact);
    setShowForm(true);
    setFormError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("이름을 입력해주세요.");
      return;
    }
    if (!phone.trim()) {
      setFormError("전화번호를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);

    if (editingContact) {
      const { error: updateError } = await supabase
        .from("emergency_contacts")
        .update({
          name: name.trim(),
          category,
          phone: phone.trim(),
          address: address.trim() || null,
        })
        .eq("id", editingContact.id);

      if (updateError) {
        setFormError("연락처 수정에 실패했습니다.");
        console.error("Update error:", updateError);
      } else {
        resetForm();
        await fetchContacts();
      }
    } else {
      const { error: insertError } = await supabase
        .from("emergency_contacts")
        .insert({
          property_id: propertyId,
          name: name.trim(),
          category,
          phone: phone.trim(),
          address: address.trim() || null,
        });

      if (insertError) {
        setFormError("연락처 등록에 실패했습니다.");
        console.error("Insert error:", insertError);
      } else {
        resetForm();
        await fetchContacts();
      }
    }
    setIsSubmitting(false);
  }

  async function handleDelete(contactId: string) {
    if (!confirm("이 연락처를 삭제하시겠습니까?")) return;

    setDeletingId(contactId);
    setError("");

    const { error: deleteError } = await supabase
      .from("emergency_contacts")
      .delete()
      .eq("id", contactId);

    if (deleteError) {
      setError("연락처 삭제에 실패했습니다.");
      console.error("Delete error:", deleteError);
    } else {
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      if (editingContact?.id === contactId) {
        resetForm();
      }
    }
    setDeletingId(null);
  }

  function getCategoryLabel(cat: EmergencyContact["category"]): string {
    return CATEGORY_OPTIONS.find((o) => o.value === cat)?.label ?? cat;
  }

  if (isFetching) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">긴급 연락처</h1>
          <p className="mt-1 text-sm text-gray-500">
            게스트에게 제공할 긴급 연락처를 관리하세요.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            연락처 추가
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <Card title={editingContact ? "연락처 수정" : "새 긴급 연락처"}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="이름 *"
              placeholder="예: 세종병원, 강남경찰서"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />

            <Select
              label="카테고리"
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value as EmergencyContact["category"]
                )
              }
              options={CATEGORY_OPTIONS}
              disabled={isSubmitting}
            />

            <Input
              label="전화번호 *"
              placeholder="예: 02-1234-5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
            />

            <Input
              label="주소"
              placeholder="주소를 입력하세요 (선택)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isSubmitting}
            />

            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={resetForm}
                disabled={isSubmitting}
              >
                취소
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {editingContact ? "수정하기" : "등록하기"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          연락처 목록 ({contacts.length})
        </h2>

        {contacts.length === 0 ? (
          <EmptyState
            icon={
              <svg
                className="h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
                />
              </svg>
            }
            title="등록된 연락처가 없습니다"
            description="긴급 연락처를 추가하여 게스트에게 제공하세요."
            action={
              !showForm ? (
                <Button onClick={() => setShowForm(true)} size="sm">
                  연락처 추가
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                    {getCategoryLabel(contact.category)}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">
                      {contact.name}
                    </p>
                    <p className="text-sm text-gray-500">{contact.phone}</p>
                    {contact.address && (
                      <p className="text-xs text-gray-400">
                        {contact.address}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(contact)}
                  >
                    수정
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(contact.id)}
                    loading={deletingId === contact.id}
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    삭제
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

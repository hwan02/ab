"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDate } from "@/lib/utils";
import type { Profile, PropertyGuest } from "@/types/database";

interface GuestWithProfile extends PropertyGuest {
  profiles: Profile;
}

export default function GuestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: propertyId } = use(params);
  const supabase = createClient();
  const [guests, setGuests] = useState<GuestWithProfile[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [email, setEmail] = useState("");
  const [searchResult, setSearchResult] = useState<Profile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  useEffect(() => {
    fetchGuests();
  }, [propertyId]);

  async function fetchGuests() {
    setIsFetching(true);
    const { data, error: fetchError } = await supabase
      .from("property_guests")
      .select("*, profiles(*)")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Fetch guests error:", fetchError);
      setError("게스트 목록을 불러오는데 실패했습니다.");
    } else {
      setGuests((data as GuestWithProfile[]) ?? []);
    }
    setIsFetching(false);
  }

  async function handleSearchEmail() {
    if (!email.trim()) return;

    setIsSearching(true);
    setSearchError("");
    setSearchResult(null);

    const { data, error: searchErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email.trim())
      .single();

    if (searchErr || !data) {
      setSearchError("해당 이메일의 사용자를 찾을 수 없습니다.");
    } else {
      const alreadyAdded = guests.some(
        (g) => g.guest_id === (data as Profile).id
      );
      if (alreadyAdded) {
        setSearchError("이미 등록된 게스트입니다.");
      } else {
        setSearchResult(data as Profile);
      }
    }
    setIsSearching(false);
  }

  async function handleAddGuest() {
    if (!searchResult) return;

    setIsAdding(true);
    setError("");

    const { error: insertError } = await supabase
      .from("property_guests")
      .insert({
        property_id: propertyId,
        guest_id: searchResult.id,
        check_in: checkIn || null,
        check_out: checkOut || null,
      });

    if (insertError) {
      setError("게스트 추가에 실패했습니다.");
      console.error("Insert error:", insertError);
    } else {
      setEmail("");
      setSearchResult(null);
      setCheckIn("");
      setCheckOut("");
      await fetchGuests();
    }
    setIsAdding(false);
  }

  async function handleRemoveGuest(guestRecordId: string) {
    setRemovingId(guestRecordId);
    setError("");

    const { error: deleteError } = await supabase
      .from("property_guests")
      .delete()
      .eq("id", guestRecordId);

    if (deleteError) {
      setError("게스트 제거에 실패했습니다.");
      console.error("Delete error:", deleteError);
    } else {
      setGuests((prev) => prev.filter((g) => g.id !== guestRecordId));
    }
    setRemovingId(null);
  }

  if (isFetching) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">게스트 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          이 숙소의 게스트를 추가하거나 제거하세요.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card title="게스트 추가">
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="게스트 이메일을 입력하세요"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSearchResult(null);
                  setSearchError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearchEmail();
                  }
                }}
              />
            </div>
            <Button
              onClick={handleSearchEmail}
              loading={isSearching}
              variant="secondary"
            >
              검색
            </Button>
          </div>

          {searchError && (
            <p className="text-sm text-red-600">{searchError}</p>
          )}

          {searchResult && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {searchResult.name || "이름 없음"}
                  </p>
                  <p className="text-sm text-gray-500">{searchResult.email}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="체크인 날짜"
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
                <Input
                  label="체크아웃 날짜"
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </div>

              <div className="mt-4">
                <Button onClick={handleAddGuest} loading={isAdding} size="sm">
                  게스트 추가
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          등록된 게스트 ({guests.length})
        </h2>

        {guests.length === 0 ? (
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
                  d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                />
              </svg>
            }
            title="등록된 게스트가 없습니다"
            description="이메일로 게스트를 검색하여 추가하세요."
          />
        ) : (
          <div className="space-y-3">
            {guests.map((guest) => (
              <div
                key={guest.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                    {guest.profiles?.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {guest.profiles?.name || "이름 없음"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {guest.profiles?.email}
                    </p>
                    <div className="mt-1 flex gap-3 text-xs text-gray-400">
                      {guest.check_in && (
                        <span>체크인: {formatDate(guest.check_in)}</span>
                      )}
                      {guest.check_out && (
                        <span>체크아웃: {formatDate(guest.check_out)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveGuest(guest.id)}
                  loading={removingId === guest.id}
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  제거
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { ANSWER_LANG_LABELS, detectLanguage, matchRule, pickAnswerWithLang, renderAnswer, withPhotoLink, type ReplyRule } from "@/lib/airbnb/rules";
import type { AirbnbReplyRule, Property } from "@/types/database";
import { fillFoodVariables, type FoodPlace } from "@/lib/food/places";
import { fillGroupVariables, type FoodGroup, type FoodGroupItem } from "@/lib/food/groups";

type PropertyBits = Pick<Property, "id" | "name" | "wifi_ssid" | "wifi_password" | "checkin_time" | "checkout_time" | "address">;

/** 자동응답 > 테스트 탭. 게스트 메시지를 넣어 보면 감지 언어 · 매칭 규칙 · 나갈 답변을 미리 본다. 매칭·렌더는 rules.ts 그대로. */
export default function RuleTester({ propertyId, refreshKey = 0 }: { propertyId: string; refreshKey?: number }) {
  const supabase = useMemo(() => createClient(), []);

  const [property, setProperty] = useState<PropertyBits | null>(null);
  const [rules, setRules] = useState<AirbnbReplyRule[]>([]);
  const [food, setFood] = useState<FoodPlace[]>([]);
  const [groups, setGroups] = useState<FoodGroup[]>([]);
  const [groupItems, setGroupItems] = useState<FoodGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [guestName, setGuestName] = useState("민지");
  const [booked, setBooked] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: r }, { data: f }] = await Promise.all([
        supabase.from("properties").select("id, name, wifi_ssid, wifi_password, checkin_time, checkout_time, address").eq("id", propertyId).single(),
        supabase.from("airbnb_reply_rules").select("*").eq("property_id", propertyId).order("priority", { ascending: false }).order("created_at", { ascending: true }),
        supabase.from("food_places").select("*").eq("property_id", propertyId),
      ]);
      const { data: g } = await supabase.from("food_groups").select("*").eq("property_id", propertyId);
      const gids = ((g ?? []) as FoodGroup[]).map((x) => x.id);
      const { data: it } = gids.length ? await supabase.from("food_group_items").select("*").in("group_id", gids) : { data: [] };
      if (cancelled) return;
      setProperty((p as PropertyBits) ?? null);
      setRules((r as AirbnbReplyRule[]) ?? []);
      setFood((f as FoodPlace[]) ?? []);
      setGroups((g as FoodGroup[]) ?? []);
      setGroupItems((it as FoodGroupItem[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, propertyId, refreshKey]);

  const result = useMemo(() => {
    if (!message.trim()) return null;
    const detected = detectLanguage(message);
    const m = matchRule(message, rules as ReplyRule[]);
    if (!m) return { matched: null, text: "", detected, answerLang: detected };
    const picked = pickAnswerWithLang(m.rule, message);
    const text = renderAnswer(picked.text, {
      guestName: guestName.trim() || "게스트",
      propertyName: property?.name,
      checkIn: "2026-12-23",
      checkOut: "2026-12-27",
      checkinTime: property?.checkin_time,
      checkoutTime: property?.checkout_time,
      wifiSsid: property?.wifi_ssid,
      wifiPassword: property?.wifi_password,
      address: property?.address,
    });
    // 실제 발송과 같은 규칙: 예약 확정 게스트에게만 링크(장소 지도·규칙 사진)를 붙인다.
    const site = booked && typeof window !== "undefined" ? window.location.origin : false;
    const withFood = fillGroupVariables(fillFoodVariables(text, food.filter((x) => !x.hidden), picked.answerLang, site), groups, groupItems, food, picked.answerLang, site);
    const withLink = site ? withPhotoLink(withFood, m.rule, site, picked.answerLang) : withFood;
    return { matched: m.rule, text: withLink, detected, answerLang: picked.answerLang };
  }, [message, rules, property, guestName, food, groups, groupItems, booked]);

  if (loading) return <div className="p-8 text-sm text-gray-500">불러오는 중...</div>;

  return (
    <div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Input label="게스트 이름" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1" role="radiogroup" aria-label="게스트 상태">
          {[
            { v: true, label: "예약 확정" },
            { v: false, label: "예약 전 문의" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={booked === o.v}
              onClick={() => setBooked(o.v)}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium", booked === o.v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900")}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {!booked && <p className="mb-2 text-xs text-gray-400">예약 전 게스트에게는 에어비앤비가 링크를 막아 링크 없이 나갑니다.</p>}
      <Textarea label="게스트 메시지" placeholder="예) 혹시 와이파이 비밀번호가 뭔가요?" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />

      {result && (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-b border-gray-100 px-4 py-3 text-sm">
            <dt className="text-gray-500">감지 언어</dt>
            <dd className="font-medium text-gray-900">{ANSWER_LANG_LABELS[result.detected]}</dd>
            <dt className="text-gray-500">매칭 규칙</dt>
            <dd className={cn("font-medium", result.matched ? "text-gray-900" : "text-gray-400")}>{result.matched ? result.matched.name : "없음"}</dd>
            {result.matched && (
              <>
                <dt className="text-gray-500">답변 언어</dt>
                <dd className="font-medium text-gray-900">
                  {ANSWER_LANG_LABELS[result.answerLang]}
                  {result.answerLang !== result.detected && <span className="ml-1 font-normal text-gray-400">({ANSWER_LANG_LABELS[result.detected]} 답변 없음)</span>}
                </dd>
              </>
            )}
          </dl>
          <div className="px-4 py-3">
            <p className="mb-1 text-xs text-gray-500">나갈 답변</p>
            {result.matched ? (
              <p className="whitespace-pre-wrap text-sm text-gray-900">{result.text}</p>
            ) : (
              <p className="text-sm text-gray-400">없음</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { ANSWER_LANG_LABELS, detectLanguage, matchRule, pickAnswerWithLang, renderAnswer, type ReplyRule } from "@/lib/airbnb/rules";
import type { AirbnbReplyRule, Property } from "@/types/database";

type PropertyBits = Pick<Property, "id" | "name" | "wifi_ssid" | "wifi_password" | "checkin_time" | "checkout_time" | "address">;

/** 자동응답 > 테스트 탭. 게스트 메시지를 넣어 보면 감지 언어 · 매칭 규칙 · 나갈 답변을 미리 본다. 매칭·렌더는 rules.ts 그대로. */
export default function RuleTester({ propertyId, refreshKey = 0 }: { propertyId: string; refreshKey?: number }) {
  const supabase = useMemo(() => createClient(), []);

  const [property, setProperty] = useState<PropertyBits | null>(null);
  const [rules, setRules] = useState<AirbnbReplyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [guestName, setGuestName] = useState("민지");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("properties").select("id, name, wifi_ssid, wifi_password, checkin_time, checkout_time, address").eq("id", propertyId).single(),
        supabase.from("airbnb_reply_rules").select("*").eq("property_id", propertyId).order("priority", { ascending: false }).order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      setProperty((p as PropertyBits) ?? null);
      setRules((r as AirbnbReplyRule[]) ?? []);
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
    return { matched: m.rule, text, detected, answerLang: picked.answerLang };
  }, [message, rules, property, guestName]);

  if (loading) return <div className="p-8 text-sm text-gray-500">불러오는 중...</div>;

  return (
    <div>

      <div className="mb-3 max-w-xs">
        <Input label="게스트 이름" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
      </div>
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

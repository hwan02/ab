"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import { UNMAPPED_FILTER } from "@/lib/airbnb/sync";
import type { AirbnbInboundMail, AirbnbInboundStatus, AirbnbMailKind, Property } from "@/types/database";

type Filter = "all" | "todo" | "replied";

const KIND_LABEL: Record<AirbnbMailKind, string> = {
  message: "💬 메시지",
  reservation_request: "📅 예약 요청",
  reservation_confirmed: "✅ 예약 확정",
  reservation_cancelled: "❌ 예약 취소",
  review: "⭐ 후기",
  other: "📨 알림",
};

const STATUS_LABEL: Record<AirbnbInboundStatus, { text: string; className: string }> = {
  new: { text: "답변 필요", className: "bg-rose-100 text-rose-700" },
  drafted: { text: "답변 준비됨", className: "bg-amber-100 text-amber-700" },
  replied: { text: "답장 완료", className: "bg-emerald-100 text-emerald-700" },
  ignored: { text: "무시", className: "bg-gray-100 text-gray-500" },
};

function formatReceived(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const UNMAPPED_LABEL = "숙소 미확정";

interface Props {
  initialMails: AirbnbInboundMail[];
  /** 필터에 보여 줄 숙소. 호스트는 자기 숙소만, 관리자는 전부. */
  properties: Pick<Property, "id" | "name">[];
  rules: { id: string; name: string }[];
  /** 현재 숙소 필터(?property=). 빈 문자열이면 전체. 관리자는 UNMAPPED_FILTER 로 '숙소 미확정'만. */
  selectedProperty?: string;
  isAdmin?: boolean;
}

export default function AirbnbInbox({ initialMails, properties, rules, selectedProperty = "", isAdmin = false }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const [mails, setMails] = useState<AirbnbInboundMail[]>(initialMails);
  const [filter, setFilter] = useState<Filter>("todo");
  const [expanded, setExpanded] = useState<string | null>(initialMails[0]?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const ruleName = useCallback((id: string | null) => (id ? rules.find((r) => r.id === id)?.name ?? null : null), [rules]);

  const propertyName = useCallback(
    (id: string | null) => (id ? properties.find((p) => p.id === id)?.name ?? null : null),
    [properties]
  );

  /** 카드마다 항상 보여 줄 숙소 표시. 매핑 안 됐으면 '숙소 미확정'과 메일의 리스팅 제목. */
  const placeLabel = (mail: AirbnbInboundMail) => {
    const name = propertyName(mail.property_id);
    if (name) return { text: name, unmapped: false };
    const title = mail.listing_name?.trim();
    return { text: title ? `${UNMAPPED_LABEL} · ${title}` : UNMAPPED_LABEL, unmapped: true };
  };

  const selectProperty = (value: string) => {
    router.push(value ? `${pathname}?property=${encodeURIComponent(value)}` : pathname);
  };

  const propertyOptions: { value: string; label: string }[] = [
    { value: "", label: "전체 숙소" },
    ...properties.map((p) => ({ value: p.id, label: p.name })),
    ...(isAdmin ? [{ value: UNMAPPED_FILTER, label: UNMAPPED_LABEL }] : []),
  ];

  const visible = mails.filter((m) => {
    if (filter === "todo") return m.status === "new" || m.status === "drafted";
    if (filter === "replied") return m.status === "replied";
    return true;
  });

  const patch = (id: string, changes: Partial<AirbnbInboundMail>) =>
    setMails((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)));

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2000);
  };

  const setStatus = async (id: string, status: AirbnbInboundStatus) => {
    setBusy(id);
    const changes: Partial<AirbnbInboundMail> = { status };
    if (status === "replied") changes.replied_at = new Date().toISOString();
    const { error } = await supabase.from("airbnb_inbound_mails").update(changes).eq("id", id);
    setBusy(null);
    if (error) return flash("상태 변경 실패: " + error.message);
    patch(id, changes);
  };

  const saveDraft = async (id: string, draft: string) => {
    setBusy(id);
    const { error } = await supabase.from("airbnb_inbound_mails").update({ draft_reply: draft }).eq("id", id);
    setBusy(null);
    if (error) return flash("저장 실패: " + error.message);
    flash("초안을 저장했습니다");
  };

  const regenerate = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch("/api/airbnb/inbox/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "실패");
      if (json.failed?.length) throw new Error(json.failed[0].error);
      const { data } = await supabase.from("airbnb_inbound_mails").select("draft_reply, status").eq("id", id).single();
      if (data) patch(id, data as Partial<AirbnbInboundMail>);
      flash("초안을 다시 만들었습니다");
    } catch (e) {
      flash("초안 생성 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const sendByMail = async (mail: AirbnbInboundMail) => {
    const text = (mail.draft_reply ?? "").trim();
    if (!text) return flash("보낼 답장이 없습니다.");
    if (!confirm(`${mail.guest_name ?? "게스트"}님에게 이 답장을 에어비앤비로 보낼까요?\n\n${text.slice(0, 200)}${text.length > 200 ? "…" : ""}`)) return;
    setBusy(mail.id);
    try {
      const res = await fetch("/api/airbnb/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: mail.id, text }),
      });
      const json = await res.json();
      if (res.status === 409) {
        // 자동 발송이나 다른 탭이 먼저 보냈다. 화면도 '답장 완료'로 맞춘다.
        patch(mail.id, { status: "replied" });
        throw new Error(json.error ?? "이미 발송된 메일입니다.");
      }
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "실패");
      patch(mail.id, { status: "replied", replied_at: json.sentAt, sent_reply: text, sent_at: json.sentAt });
      flash("보냈습니다. 에어비앤비 스레드에 올라가는 데 몇 분 걸릴 수 있습니다.");
    } catch (e) {
      flash("발송 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash("복사했습니다. 에어비앤비에 붙여넣으세요.");
    } catch {
      flash("복사 실패. 직접 선택해서 복사해 주세요.");
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full bg-white p-1 shadow-sm">
            {(
              [
                ["todo", "할 일"],
                ["replied", "답장 완료"],
                ["all", "전체"],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all",
                  filter === key ? "bg-rose-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            <span className="sr-only">숙소 필터</span>
            <select
              value={selectedProperty}
              onChange={(e) => selectProperty(e.target.value)}
              className={cn(
                "rounded-full border border-gray-200 bg-white py-1 pl-3 pr-7 text-xs font-medium text-gray-700 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20",
                selectedProperty === UNMAPPED_FILTER && "border-amber-300 text-amber-700"
              )}
              aria-label="숙소 필터"
            >
              {propertyOptions.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {notice && <span className="text-xs text-gray-500">{notice}</span>}
      </div>

      {selectedProperty === UNMAPPED_FILTER && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          숙소를 정하지 못한 메일입니다. 메일의 리스팅 제목과 같은 값을 해당 숙소의 &quot;에어비앤비 리스팅 제목&quot;에 넣으면 다음 동기화 때 자동으로
          붙고 규칙이 적용됩니다. (최근 7일 메일만 다시 매핑합니다)
        </p>
      )}

      {visible.length === 0 ? (
        <Card className="py-12 text-center text-sm text-gray-500">
          {filter === "todo" ? "처리할 메시지가 없습니다." : "메일이 없습니다."}
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((mail) => {
            const isOpen = expanded === mail.id;
            const status = STATUS_LABEL[mail.status];
            const place = placeLabel(mail);
            return (
              <Card key={mail.id} className="p-4">
                <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setExpanded(isOpen ? null : mail.id)}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{mail.guest_name ?? "게스트"}</span>
                      <span className="text-xs text-gray-500">{KIND_LABEL[mail.kind]}</span>
                      <span className={cn("text-xs", place.unmapped ? "font-medium text-amber-600" : "text-gray-400")} title={mail.listing_name ?? undefined}>
                        · {place.text}
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", status.className)}>{status.text}</span>
                      {mail.auto_sent && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">🤖 자동 발송</span>}
                      {mail.matched_rule_id && ruleName(mail.matched_rule_id) && (
                        <span className="text-[11px] text-gray-400">규칙: {ruleName(mail.matched_rule_id)}</span>
                      )}
                    </div>
                    <p className={cn("mt-1 text-sm text-gray-600", !isOpen && "line-clamp-2")}>
                      {mail.message_text ?? mail.snippet ?? mail.subject}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">{formatReceived(mail.received_at)}</span>
                </button>

                {isOpen && (
                  <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                    {(mail.check_in || mail.reservation_code) && (
                      <p className="text-xs text-gray-500">
                        {mail.check_in && `${mail.check_in} ~ ${mail.check_out ?? "?"}`}
                        {mail.reservation_code && ` · 예약 ${mail.reservation_code}`}
                      </p>
                    )}

                    {mail.kind === "message" && (
                      <DraftEditor
                        mail={mail}
                        busy={busy === mail.id}
                        onChange={(v) => patch(mail.id, { draft_reply: v })}
                        onSave={(v) => saveDraft(mail.id, v)}
                        onCopy={copy}
                        onRegenerate={process.env.NEXT_PUBLIC_AIRBNB_AI_DRAFT === "on" ? () => regenerate(mail.id) : undefined}
                        onSend={mail.reply_to && mail.status !== "replied" ? () => sendByMail(mail) : undefined}
                      />
                    )}
                    {mail.kind === "message" && !mail.matched_rule_id && mail.property_id && mail.status !== "replied" && (
                      <Link
                        href={`/host/property/${mail.property_id}/rules?q=${encodeURIComponent((mail.message_text ?? "").slice(0, 300))}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline"
                      >
                        + 이 메시지로 포포톡 규칙 만들기
                      </Link>
                    )}
                    {mail.sent_reply && (
                      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        메일로 보낸 답장 ({mail.sent_at ? formatReceived(mail.sent_at) : ""}): {mail.sent_reply.slice(0, 160)}
                        {mail.sent_reply.length > 160 ? "…" : ""}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {mail.thread_url ? (
                        <a
                          href={mail.thread_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-600"
                        >
                          에어비앤비에서 답장 ↗
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">스레드 링크 없음</span>
                      )}
                      <div className="flex gap-1">
                        {mail.status !== "replied" && (
                          <Button size="sm" variant="secondary" loading={busy === mail.id} onClick={() => setStatus(mail.id, "replied")}>
                            답장 완료
                          </Button>
                        )}
                        {mail.status !== "ignored" && (
                          <Button size="sm" variant="ghost" loading={busy === mail.id} onClick={() => setStatus(mail.id, "ignored")}>
                            무시
                          </Button>
                        )}
                        {(mail.status === "replied" || mail.status === "ignored") && (
                          <Button size="sm" variant="ghost" loading={busy === mail.id} onClick={() => setStatus(mail.id, mail.draft_reply ? "drafted" : "new")}>
                            되돌리기
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DraftEditor({
  mail,
  busy,
  onChange,
  onSave,
  onCopy,
  onRegenerate,
  onSend,
}: {
  mail: AirbnbInboundMail;
  busy: boolean;
  onChange: (v: string) => void;
  onSave: (v: string) => void;
  onCopy: (v: string) => void;
  /** AI 초안 경로(선택). 키워드 규칙만 쓸 때는 넘기지 않는다. */
  onRegenerate?: () => void;
  /** 회신 주소가 있을 때만 전달됨. 메일 회신으로 바로 보낸다. */
  onSend?: () => void;
}) {
  const draft = mail.draft_reply ?? "";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">보낼 답변</span>
        {onRegenerate && (
          <button onClick={onRegenerate} disabled={busy} className="text-xs text-rose-500 hover:underline disabled:opacity-50">
            AI 초안 생성
          </button>
        )}
      </div>
      <Textarea
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder={busy ? "처리 중..." : "매칭된 규칙이 없습니다. 직접 입력하거나 아래에서 규칙을 만드세요."}
      />
      <div className="mt-2 flex justify-end gap-1">
        <Button size="sm" variant="ghost" disabled={!draft || busy} onClick={() => onSave(draft)}>
          저장
        </Button>
        <Button size="sm" variant={onSend ? "secondary" : "primary"} disabled={!draft} onClick={() => onCopy(draft)}>
          초안 복사
        </Button>
        {onSend && (
          <Button size="sm" disabled={!draft || busy} loading={busy} onClick={onSend}>
            메일로 바로 답장
          </Button>
        )}
      </div>
    </div>
  );
}

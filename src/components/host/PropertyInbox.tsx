"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import type { AirbnbInboundMail, AirbnbMailKind } from "@/types/database";

/**
 * 숙소 수신함. 탭 3개(답변 필요 · 처리됨 · 전체), 행은 게스트 · 시각 · 메시지 한 줄 · 상태 칩 하나.
 * 행을 누르면 그 자리에서 펼쳐져 전문과 '보낼 답변'이 나온다.
 *  - 답변 필요: 게스트 메시지(kind=message) 중 new / drafted
 *  - 처리됨: 게스트 메시지 중 replied / ignored
 *  - 전체: 예약 확정·취소·후기 같은 알림도 회색으로 함께
 * 초안 저장·무시·되돌리기는 /api/airbnb/inbox/update, 발송은 /api/airbnb/inbox/send 를 거친다(권한은 서버가 검사).
 */

type Tab = "todo" | "done" | "all";
type EditableStatus = "new" | "drafted" | "ignored";

const KIND_LABEL: Record<Exclude<AirbnbMailKind, "message">, string> = {
  reservation_request: "예약 요청",
  reservation_confirmed: "예약 확정",
  reservation_cancelled: "예약 취소",
  review: "후기",
  other: "알림",
};

function statusChip(mail: AirbnbInboundMail): { text: string; className: string } {
  if (mail.status === "replied") {
    return mail.auto_sent
      ? { text: "자동 발송됨", className: "bg-emerald-50 text-emerald-700" }
      : { text: "답장 완료", className: "bg-emerald-50 text-emerald-700" };
  }
  if (mail.status === "ignored") return { text: "무시", className: "bg-gray-100 text-gray-500" };
  if (mail.status === "drafted") return { text: "답변 준비됨", className: "bg-gray-100 text-gray-700" };
  return { text: "답변 필요", className: "bg-rose-50 text-rose-700" };
}

/** "10/20 14:05" (Asia/Seoul) */
export function formatSeoul(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("month")}/${get("day")} ${hour}:${get("minute")}`;
}

export const isPending = (m: AirbnbInboundMail) => m.kind === "message" && (m.status === "new" || m.status === "drafted");
const isDone = (m: AirbnbInboundMail) => m.kind === "message" && (m.status === "replied" || m.status === "ignored");

async function postJson(url: string, body: unknown): Promise<{ res: Response; json: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, json };
}

const errorOf = (json: Record<string, unknown>, fallback: string) =>
  (typeof json.detail === "string" && json.detail) || (typeof json.error === "string" && json.error) || fallback;

interface Props {
  initialMails: AirbnbInboundMail[];
  /** 관리자 전역 수신함에서만: 행에 숙소 이름을 함께 보여 준다. */
  propertyNames?: Record<string, string>;
}

export default function PropertyInbox({ initialMails, propertyNames }: Props) {
  const [mails, setMails] = useState<AirbnbInboundMail[]>(initialMails);
  const [tab, setTab] = useState<Tab>("todo");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 메일별로 DB 에 마지막으로 저장된 초안. 로컬 state 는 타이핑마다 바뀌므로 저장 여부는 이것과 비교한다. */
  const savedDrafts = useRef<Record<string, string>>(Object.fromEntries(initialMails.map((m) => [m.id, m.draft_reply ?? ""])));

  useEffect(() => {
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, []);

  const pendingCount = mails.filter(isPending).length;

  const visible = mails.filter((m) => (tab === "todo" ? isPending(m) : tab === "done" ? isDone(m) : true));

  const patch = (id: string, changes: Partial<AirbnbInboundMail>) =>
    setMails((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)));

  const fail = (msg: string) => {
    setError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 3000);
  };

  const saveDraft = async (mail: AirbnbInboundMail, text: string) => {
    if ((savedDrafts.current[mail.id] ?? "") === text) return;
    const { res, json } = await postJson("/api/airbnb/inbox/update", { id: mail.id, draft_reply: text });
    if (!res.ok) return fail("저장 실패: " + errorOf(json, String(res.status)));
    savedDrafts.current[mail.id] = text;
  };

  const setStatus = async (mail: AirbnbInboundMail, status: EditableStatus) => {
    setBusy(mail.id);
    const { res, json } = await postJson("/api/airbnb/inbox/update", { id: mail.id, status });
    setBusy(null);
    if (!res.ok) return fail("실패: " + errorOf(json, String(res.status)));
    patch(mail.id, { status });
  };

  const ignore = (mail: AirbnbInboundMail) => setStatus(mail, "ignored");
  const restore = (mail: AirbnbInboundMail) => setStatus(mail, mail.draft_reply ? "drafted" : "new");

  const send = async (mail: AirbnbInboundMail) => {
    const text = (mail.draft_reply ?? "").trim();
    if (!confirm(`${mail.guest_name ?? "게스트"}님에게 보낼까요?\n\n${text.slice(0, 200)}${text.length > 200 ? "…" : ""}`)) return;
    setBusy(mail.id);
    try {
      const { res, json } = await postJson("/api/airbnb/inbox/send", { id: mail.id, text });
      if (res.status === 409) {
        patch(mail.id, { status: "replied" });
        throw new Error(errorOf(json, "이미 발송된 메일입니다."));
      }
      if (!res.ok) throw new Error(errorOf(json, "실패"));
      const sentAt = typeof json.sentAt === "string" ? json.sentAt : new Date().toISOString();
      savedDrafts.current[mail.id] = text;
      patch(mail.id, { status: "replied", replied_at: sentAt, sent_reply: text, sent_at: sentAt, draft_reply: text });
    } catch (e) {
      fail("발송 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const tabs: [Tab, string][] = [
    ["todo", pendingCount > 0 ? `답변 필요 ${pendingCount}` : "답변 필요"],
    ["done", "처리됨"],
    ["all", "전체"],
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-500">아직 메시지가 없습니다</p>
      ) : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {visible.map((mail) => {
            const isOpen = open === mail.id;
            const isMessage = mail.kind === "message";
            const chip = isMessage ? statusChip(mail) : null;
            const propertyName = propertyNames ? propertyNames[mail.property_id ?? ""] ?? mail.listing_name ?? "숙소 미확정" : null;
            const isBusy = busy === mail.id;
            const editable = isMessage && (mail.status === "new" || mail.status === "drafted");
            const text = mail.message_text ?? mail.snippet ?? mail.subject;
            return (
              <li key={mail.id} className={cn(!isMessage && "bg-gray-50")}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : mail.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={cn("truncate text-sm font-semibold", isMessage ? "text-gray-900" : "text-gray-500")}>
                        {mail.guest_name ?? "게스트"}
                      </span>
                      {propertyName && <span className="truncate text-xs text-gray-400">{propertyName}</span>}
                      <span className="shrink-0 text-xs text-gray-400">{formatSeoul(mail.received_at)}</span>
                    </div>
                    <p className={cn("mt-0.5 truncate text-sm", isMessage ? "text-gray-600" : "text-gray-400")}>{text}</p>
                  </div>
                  {chip ? (
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", chip.className)}>{chip.text}</span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      {KIND_LABEL[mail.kind as Exclude<AirbnbMailKind, "message">]}
                    </span>
                  )}
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-gray-100 px-4 py-4">
                    <p className="whitespace-pre-wrap text-sm text-gray-800">{text}</p>

                    {isMessage && mail.status === "replied" && (
                      <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">
                        <p className="mb-1 text-xs text-gray-500">
                          {mail.auto_sent ? "자동 발송" : "보낸 답장"}
                          {mail.sent_at ? ` · ${formatSeoul(mail.sent_at)}` : ""}
                        </p>
                        {mail.sent_reply ? <p className="whitespace-pre-wrap">{mail.sent_reply}</p> : <p className="text-gray-500">에어비앤비에서 답장함</p>}
                      </div>
                    )}

                    {editable && (
                      <ReplyBox
                        mail={mail}
                        busy={isBusy}
                        onChange={(v) => patch(mail.id, { draft_reply: v })}
                        onBlur={(v) => saveDraft(mail, v)}
                        onSend={() => send(mail)}
                      />
                    )}

                    {!editable && mail.thread_url && (
                      <a href={mail.thread_url} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium text-gray-700 hover:underline">
                        에어비앤비에서 열기
                      </a>
                    )}

                    {isMessage && mail.status === "ignored" && (
                      <div className="text-xs text-gray-500">
                        <button type="button" onClick={() => restore(mail)} disabled={isBusy} className="hover:text-gray-900 hover:underline">
                          되돌리기
                        </button>
                      </div>
                    )}

                    {editable && (
                      <div className="flex gap-4 text-xs text-gray-500">
                        <button type="button" onClick={() => ignore(mail)} disabled={isBusy} className="hover:text-gray-900 hover:underline">
                          무시
                        </button>
                        {mail.property_id && (
                          <Link
                            href={`/host/property/${mail.property_id}/rules?tab=new&q=${encodeURIComponent((mail.message_text ?? "").slice(0, 300))}`}
                            className="hover:text-gray-900 hover:underline"
                          >
                            이 메시지로 규칙 만들기
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ReplyBox({
  mail,
  busy,
  onChange,
  onBlur,
  onSend,
}: {
  mail: AirbnbInboundMail;
  busy: boolean;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
  onSend: () => void;
}) {
  const draft = mail.draft_reply ?? "";
  const canSend = !!mail.reply_to;
  return (
    <div>
      <Textarea label="보낼 답변" value={draft} onChange={(e) => onChange(e.target.value)} onBlur={(e) => onBlur(e.target.value)} rows={4} />
      <div className="mt-2 flex items-center gap-2">
        <span title={canSend ? undefined : "에어비앤비에서 직접 답장"}>
          <Button size="sm" disabled={!canSend || !draft.trim() || busy} loading={busy} onClick={onSend}>
            답장 보내기
          </Button>
        </span>
        {mail.thread_url && (
          <a
            href={mail.thread_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-200"
          >
            에어비앤비에서 열기
          </a>
        )}
      </div>
    </div>
  );
}

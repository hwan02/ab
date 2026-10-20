"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { SITUATIONS, renderFoodList, type FoodPlace, type Situation } from "@/lib/food/places";

type Row = FoodPlace & { id: string };

/** 자동응답 > 맛집 탭. 상황별 목록을 수집하고 숨기기·순서·메모·직접 추가로 다듬는다. */
export default function FoodLists({ propertyId }: { propertyId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [situation, setSituation] = useState<Situation>("best");
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const flash = (m: string) => {
    setNotice(m);
    setTimeout(() => setNotice(null), 3000);
  };

  const load = useCallback(async () => {
    const { data } = await supabase.from("food_places").select("*").eq("property_id", propertyId).order("sort_order", { ascending: true });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [supabase, propertyId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("food_places").select("*").eq("property_id", propertyId).order("sort_order", { ascending: true });
      if (cancelled) return;
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, propertyId]);

  const collect = async () => {
    setCollecting(true);
    const res = await fetch("/api/food/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId }),
    });
    const json = await res.json().catch(() => ({}));
    setCollecting(false);
    if (!res.ok) return flash(json.error ?? "수집 실패");
    flash(`새로 ${json.added}곳, 갱신 ${json.updated}곳${json.photos ? `, 사진 ${json.photos}장` : ""}`);
    load();
  };

  const list = rows.filter((r) => r.situation === situation).sort((a, b) => a.sort_order - b.sort_order);
  const shown = list.filter((r) => !r.hidden);
  const hidden = list.filter((r) => r.hidden);

  const update = async (id: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("food_places").update(patch).eq("id", id);
    if (error) flash("저장 실패: " + error.message);
  };

  const move = async (index: number, dir: -1 | 1) => {
    const a = shown[index];
    const b = shown[index + dir];
    if (!a || !b) return;
    await Promise.all([update(a.id, { sort_order: b.sort_order }), update(b.id, { sort_order: a.sort_order })]);
    if (a.sort_order === b.sort_order) await update(a.id, { sort_order: b.sort_order + dir });
  };

  const addManual = async () => {
    const name = newName.trim();
    if (!name) return;
    const top = Math.min(0, ...list.map((r) => r.sort_order)) - 1;
    const { error } = await supabase.from("food_places").insert({ property_id: propertyId, situation, name, sort_order: top });
    if (error) return flash("추가 실패: " + error.message);
    setNewName("");
    load();
  };

  const remove = async (row: Row) => {
    if (row.google_place_id) return update(row.id, { hidden: true });
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    await supabase.from("food_places").delete().eq("id", row.id);
  };

  const label = SITUATIONS.find((s) => s.key === situation)!.label;
  const preview = renderFoodList(shown, "ko");

  if (loading) return <div className="p-4 text-sm text-gray-500">불러오는 중...</div>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {SITUATIONS.map((s) => {
            const n = rows.filter((r) => r.situation === s.key && !r.hidden).length;
            return (
              <button
                key={s.key}
                onClick={() => setSituation(s.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm",
                  situation === s.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {s.label}
                {n > 0 && <span className="ml-1 text-xs opacity-60">{n}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {notice && <span className="text-xs text-rose-600">{notice}</span>}
          <Button size="sm" variant={rows.length ? "secondary" : "primary"} loading={collecting} onClick={collect}>
            {rows.length ? "다시 수집" : "주변 장소 수집"}
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">아직 수집한 곳이 없습니다</div>
      ) : (
        <>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {shown.map((r, i) => (
              <div key={r.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="flex shrink-0 flex-col pt-0.5">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-xs leading-none text-gray-400 hover:text-gray-700 disabled:opacity-20" aria-label="위로">
                    ▲
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === shown.length - 1} className="text-xs leading-none text-gray-400 hover:text-gray-700 disabled:opacity-20" aria-label="아래로">
                    ▼
                  </button>
                </div>
                {r.photo_url ? (
                  <img src={r.photo_url} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-gray-100" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">{r.name}</span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {[r.category, r.walk_minutes ? `도보 ${r.walk_minutes}분` : null, r.rating ? `★${Number(r.rating).toFixed(1)}` : null, r.hours_note].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <input
                    defaultValue={r.note ?? ""}
                    onBlur={(e) => e.target.value !== (r.note ?? "") && update(r.id, { note: e.target.value || null })}
                    placeholder="메모 (게스트에게 같이 보냄)"
                    className="mt-1 w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-gray-600 hover:border-gray-200 focus:border-rose-300 focus:outline-none"
                  />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {r.maps_url && (
                    <a href={r.maps_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-700">
                      지도
                    </a>
                  )}
                  <button onClick={() => remove(r)} className="text-xs text-gray-400 hover:text-red-500">
                    빼기
                  </button>
                </div>
              </div>
            ))}
            <div className="flex gap-2 px-4 py-2.5">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addManual()}
                placeholder="직접 추가 (가게 이름)"
                className="h-8 flex-1 rounded-lg border border-gray-200 px-2.5 text-sm focus:border-rose-400 focus:outline-none"
              />
              <Button size="sm" variant="secondary" onClick={addManual}>
                추가
              </Button>
            </div>
          </div>

          {hidden.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs text-gray-400">뺀 곳 {hidden.length}</summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hidden.map((r) => (
                  <button key={r.id} onClick={() => update(r.id, { hidden: false })} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-200">
                    {r.name} 되돌리기
                  </button>
                ))}
              </div>
            </details>
          )}

          <div className="mt-6 rounded-xl bg-gray-50 px-4 py-3">
            <p className="mb-1 text-xs text-gray-500">
              답변에 <code className="rounded bg-white px-1">{`{맛집:${label}}`}</code> 을 넣으면 위에서 5곳이 이렇게 나갑니다 (예약 확정 게스트에게는 지도 링크도)
            </p>
            <p className="whitespace-pre-wrap text-sm text-gray-800">{preview || "없음"}</p>
          </div>
        </>
      )}
    </div>
  );
}

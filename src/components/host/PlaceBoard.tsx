"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { uploadMainPhoto } from "@/lib/propertyPhoto";
import { SITUATIONS, type FoodPlace, type Situation } from "@/lib/food/places";
import { groupRule, renderGroup, reorder, type FoodGroup, type FoodGroupItem } from "@/lib/food/groups";

type Place = FoodPlace & { id: string };
type Drag = { kind: "place"; placeId: string } | { kind: "item"; itemId: string; groupId: string };

const DRAG_MIME = "application/x-popotalk";

/**
 * 장소 보드. 왼쪽: 수집된 장소(사진은 이 화면에서만). 오른쪽: 호스트가 만드는 그룹.
 * 장소를 그룹으로 드래그해 넣고, 그룹 안에서도 드래그로 순서를 바꾼다. 그룹마다 키워드·문구를 적으면
 * 그 그룹용 자동응답 규칙이 함께 저장된다.
 */
export default function PlaceBoard({ propertyId }: { propertyId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [places, setPlaces] = useState<Place[]>([]);
  const [groups, setGroups] = useState<FoodGroup[]>([]);
  const [items, setItems] = useState<FoodGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Situation | "all">("all");
  const [query, setQuery] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoFor, setPhotoFor] = useState<Place | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const pickPhoto = (p: Place) => {
    setPhotoFor(p);
    fileRef.current?.click();
  };

  /** 직접 올린 사진은 같은 가게의 모든 행(상황별)에 함께 넣는다. */
  const onPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const target = photoFor;
    if (!file || !target) return;
    setUploadingId(target.id);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const url = user ? await uploadMainPhoto(supabase, user.id, file) : null;
    if (!url) {
      setUploadingId(null);
      return flash("사진 업로드 실패");
    }
    const q = supabase.from("food_places").update({ photo_url: url }).eq("property_id", propertyId);
    const { error } = target.google_place_id ? await q.eq("google_place_id", target.google_place_id) : await q.eq("id", target.id);
    setUploadingId(null);
    if (error) return flash("저장 실패: " + error.message);
    setPlaces((prev) => prev.map((x) => ((target.google_place_id ? x.google_place_id === target.google_place_id : x.id === target.id) ? { ...x, photo_url: url } : x)));
  };

  const Thumb = ({ p, size }: { p: Place; size: "lg" | "sm" }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        pickPhoto(p);
      }}
      title={p.photo_url ? "사진 바꾸기" : "사진 올리기"}
      className={cn(
        "group relative shrink-0 overflow-hidden",
        size === "lg" ? "h-12 w-12 rounded-lg" : "h-8 w-8 rounded",
        !p.photo_url && "border border-dashed border-gray-300 bg-gray-50"
      )}
    >
      {p.photo_url ? (
        <img src={p.photo_url} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
      ) : (
        <span className={cn("flex h-full w-full items-center justify-center text-gray-400", size === "lg" ? "text-lg" : "text-xs")}>+</span>
      )}
      {uploadingId === p.id && <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[10px] text-gray-500">…</span>}
      {p.photo_url && <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-[10px] text-white group-hover:flex">바꾸기</span>}
    </button>
  );

  const flash = (m: string) => {
    setNotice(m);
    setTimeout(() => setNotice(null), 3000);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: g }] = await Promise.all([
        supabase.from("food_places").select("*").eq("property_id", propertyId),
        supabase.from("food_groups").select("*").eq("property_id", propertyId).order("sort_order"),
      ]);
      const groupIds = ((g ?? []) as FoodGroup[]).map((x) => x.id);
      const { data: it } = groupIds.length
        ? await supabase.from("food_group_items").select("*").in("group_id", groupIds)
        : { data: [] };
      if (cancelled) return;
      setPlaces((p as Place[]) ?? []);
      setGroups((g as FoodGroup[]) ?? []);
      setItems((it as FoodGroupItem[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, propertyId, reloadKey]);

  /** 같은 가게는 상황이 달라도 하나로. 상황 태그는 모아서 보여 준다. */
  const pool = useMemo(() => {
    const byKey = new Map<string, Place & { tags: Situation[] }>();
    for (const p of places) {
      const key = p.google_place_id ?? p.id;
      const cur = byKey.get(key);
      if (cur) {
        if (!cur.tags.includes(p.situation)) cur.tags.push(p.situation);
      } else byKey.set(key, { ...p, tags: [p.situation] });
    }
    const q = query.trim().toLowerCase();
    return [...byKey.values()]
      .filter((p) => filter === "all" || p.tags.includes(filter))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }, [places, filter, query]);

  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  // ---------------------------------------------------------------- 수집
  const collect = async () => {
    setCollecting(true);
    const res = await fetch("/api/food/collect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId }) });
    const json = await res.json().catch(() => ({}));
    setCollecting(false);
    if (!res.ok) return flash(json.error ?? "수집 실패");
    flash(`새로 ${json.added}곳, 갱신 ${json.updated}곳${json.photos ? `, 사진 ${json.photos}장` : ""}`);
    setReloadKey((k) => k + 1);
  };

  // ---------------------------------------------------------------- 그룹
  const syncRule = async (g: FoodGroup) => {
    const rule = groupRule(g);
    const { data: existing } = await supabase.from("airbnb_reply_rules").select("id").eq("food_group_id", g.id).maybeSingle();
    if (existing) await supabase.from("airbnb_reply_rules").update({ name: rule.name, keywords: rule.keywords, answer: rule.answer, enabled: rule.enabled }).eq("id", existing.id);
    else await supabase.from("airbnb_reply_rules").insert(rule);
  };

  const createGroup = async (name: string, seed: string[] = []) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (groups.some((g) => g.name === trimmed)) {
      flash("같은 이름의 그룹이 있습니다.");
      return null;
    }
    const { data, error } = await supabase
      .from("food_groups")
      .insert({ property_id: propertyId, name: trimmed, keywords: [], sort_order: groups.length })
      .select("*")
      .single();
    if (error || !data) {
      flash("그룹 만들기 실패: " + (error?.message ?? ""));
      return null;
    }
    const g = data as FoodGroup;
    if (seed.length) await supabase.from("food_group_items").insert(seed.map((food_place_id, i) => ({ group_id: g.id, food_place_id, sort_order: i })));
    await syncRule(g);
    return g;
  };

  const addGroup = async () => {
    const g = await createGroup(newGroup);
    if (!g) return;
    setNewGroup("");
    setGroups((prev) => [...prev, g]);
  };

  /** 처음 쓰는 숙소: 자동 분류(맛집·한식·아침·야식·카페·술집)대로 그룹을 만들고 상위 5곳씩 넣는다. */
  const seedGroups = async () => {
    for (const s of SITUATIONS) {
      const top = places
        .filter((p) => p.situation === s.key && !p.hidden)
        .sort((a, b) => a.sort_order - b.sort_order)
        .slice(0, 5)
        .map((p) => p.id);
      if (top.length) await createGroup(s.label, top);
    }
    setReloadKey((k) => k + 1);
  };

  const updateGroup = async (g: FoodGroup, patch: Partial<FoodGroup>) => {
    const next = { ...g, ...patch };
    if (patch.name !== undefined && groups.some((x) => x.id !== g.id && x.name === patch.name?.trim())) return flash("같은 이름의 그룹이 있습니다.");
    setGroups((prev) => prev.map((x) => (x.id === g.id ? next : x)));
    const { error } = await supabase.from("food_groups").update(patch).eq("id", g.id);
    if (error) return flash("저장 실패: " + error.message);
    if (patch.name !== undefined || patch.keywords !== undefined) await syncRule(next);
  };

  const deleteGroup = async (g: FoodGroup) => {
    if (!confirm(`"${g.name}" 그룹을 삭제할까요? 이 그룹의 자동응답 규칙도 함께 삭제됩니다.`)) return;
    setGroups((prev) => prev.filter((x) => x.id !== g.id));
    setItems((prev) => prev.filter((x) => x.group_id !== g.id));
    await supabase.from("food_groups").delete().eq("id", g.id);
  };

  // ---------------------------------------------------------------- 항목 (드래그)
  const saveOrder = async (groupId: string, list: FoodGroupItem[]) => {
    const ordered = list.map((it, i) => ({ ...it, group_id: groupId, sort_order: i }));
    setItems((prev) => [...prev.filter((x) => x.group_id !== groupId && !ordered.some((o) => o.id === x.id)), ...ordered]);
    await Promise.all(ordered.map((it) => supabase.from("food_group_items").update({ group_id: groupId, sort_order: it.sort_order }).eq("id", it.id)));
  };

  const groupItems = (groupId: string) => items.filter((x) => x.group_id === groupId).sort((a, b) => a.sort_order - b.sort_order);

  const addPlace = async (groupId: string, placeId: string, index: number) => {
    const list = groupItems(groupId);
    if (list.some((x) => x.food_place_id === placeId)) return flash("이미 들어 있습니다.");
    const { data, error } = await supabase.from("food_group_items").insert({ group_id: groupId, food_place_id: placeId, sort_order: index }).select("*").single();
    if (error || !data) return flash("추가 실패: " + (error?.message ?? ""));
    const next = [...list];
    next.splice(index, 0, data as FoodGroupItem);
    await saveOrder(groupId, next);
  };

  const removeItem = async (it: FoodGroupItem) => {
    setItems((prev) => prev.filter((x) => x.id !== it.id));
    await supabase.from("food_group_items").delete().eq("id", it.id);
  };

  const onDragStart = (e: DragEvent, d: Drag) => {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(d));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDrop = async (e: DragEvent, groupId: string, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    const d = JSON.parse(raw) as Drag;
    if (d.kind === "place") return addPlace(groupId, d.placeId, index);
    const moving = items.find((x) => x.id === d.itemId);
    if (!moving) return;
    if (d.groupId === groupId) return saveOrder(groupId, reorder(groupItems(groupId), d.itemId, index));
    if (groupItems(groupId).some((x) => x.food_place_id === moving.food_place_id)) return flash("이미 들어 있습니다.");
    await saveOrder(d.groupId, groupItems(d.groupId).filter((x) => x.id !== d.itemId));
    const target = groupItems(groupId);
    target.splice(index, 0, moving);
    await saveOrder(groupId, target);
  };

  const allowDrop = (e: DragEvent, key: string) => {
    e.preventDefault();
    setDropTarget(key);
  };

  // ---------------------------------------------------------------- 화면
  if (loading) return <div className="p-4 text-sm text-gray-500">불러오는 중...</div>;

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPhotoFile} className="hidden" />
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {notice && <span className="mr-auto text-xs text-rose-600">{notice}</span>}
        <Button size="sm" variant={places.length ? "secondary" : "primary"} loading={collecting} onClick={collect}>
          {places.length ? "다시 수집" : "주변 장소 수집"}
        </Button>
      </div>

      {places.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">아직 수집한 장소가 없습니다</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          {/* 수집된 장소 */}
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="space-y-2 border-b border-gray-100 p-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="장소 검색"
                className="h-8 w-full rounded-lg border border-gray-200 px-2.5 text-sm focus:border-rose-400 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1">
                {[{ key: "all" as const, label: "전체" }, ...SITUATIONS].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setFilter(s.key)}
                    className={cn("rounded-full px-2.5 py-0.5 text-xs", filter === s.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <ul className="max-h-[70vh] divide-y divide-gray-50 overflow-y-auto">
              {pool.map((p) => (
                <li
                  key={p.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, { kind: "place", placeId: p.id })}
                  className="flex cursor-grab items-center gap-3 px-3 py-2 hover:bg-gray-50 active:cursor-grabbing"
                >
                  <Thumb p={p} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="truncate text-xs text-gray-400">
                      {[p.category, p.walk_minutes ? `도보 ${p.walk_minutes}분` : null, p.rating ? `★${Number(p.rating).toFixed(1)}` : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {groups.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => e.target.value && addPlace(e.target.value, p.id, groupItems(e.target.value).length)}
                      className="h-7 shrink-0 rounded-md border border-gray-200 bg-white px-1 text-xs text-gray-500 lg:hidden"
                      aria-label="그룹에 넣기"
                    >
                      <option value="">+ 그룹</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              ))}
              {pool.length === 0 && <li className="px-3 py-6 text-center text-sm text-gray-400">없음</li>}
            </ul>
          </section>

          {/* 그룹 */}
          <section className="space-y-3">
            <div className="flex gap-2">
              <input
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGroup()}
                placeholder="새 그룹 이름 (예: 비 오는 날)"
                className="h-9 flex-1 rounded-lg border border-gray-200 px-3 text-sm focus:border-rose-400 focus:outline-none"
              />
              <Button size="sm" onClick={addGroup}>
                그룹 추가
              </Button>
            </div>

            {groups.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                <p>그룹을 만들고 왼쪽 장소를 끌어다 넣으세요</p>
                <button onClick={seedGroups} className="mt-2 text-rose-600 underline">
                  자동 분류대로 그룹 만들기
                </button>
              </div>
            )}

            {groups.map((g) => {
              const list = groupItems(g.id);
              const preview = renderGroup(g, list, places, "ko");
              return (
                <div
                  key={g.id}
                  onDragOver={(e) => allowDrop(e, g.id)}
                  onDragLeave={() => setDropTarget((t) => (t === g.id ? null : t))}
                  onDrop={(e) => onDrop(e, g.id, list.length)}
                  className={cn("rounded-xl border bg-white p-3 transition-colors", dropTarget === g.id ? "border-rose-400 bg-rose-50/40" : "border-gray-200")}
                >
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={g.name}
                      onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== g.name && updateGroup(g, { name: e.target.value.trim() })}
                      className="min-w-0 flex-1 rounded border border-transparent px-1 text-base font-semibold text-gray-900 hover:border-gray-200 focus:border-rose-300 focus:outline-none"
                    />
                    <button onClick={() => deleteGroup(g)} className="text-xs text-gray-400 hover:text-red-500">
                      삭제
                    </button>
                  </div>

                  <KeywordInput value={g.keywords} onChange={(keywords) => updateGroup(g, { keywords })} />

                  <textarea
                    defaultValue={g.intro ?? ""}
                    onBlur={(e) => e.target.value !== (g.intro ?? "") && updateGroup(g, { intro: e.target.value || null })}
                    placeholder="목록 앞에 붙일 문구 (예: 비 오는 날엔 실내에서 이런 곳 어떠세요?)"
                    rows={2}
                    className="mt-2 w-full resize-none rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-rose-400 focus:outline-none"
                  />

                  <ol className="mt-2 space-y-1">
                    {list.map((it, i) => {
                      const p = placeById.get(it.food_place_id);
                      if (!p) return null;
                      return (
                        <li
                          key={it.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, { kind: "item", itemId: it.id, groupId: g.id })}
                          onDragOver={(e) => allowDrop(e, g.id)}
                          onDrop={(e) => onDrop(e, g.id, i)}
                          className="flex cursor-grab items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5 active:cursor-grabbing"
                        >
                          <span className="w-4 shrink-0 text-center text-xs text-gray-400">{i + 1}</span>
                          <Thumb p={p} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-gray-900">{p.name}</p>
                            <input
                              defaultValue={it.note ?? ""}
                              onBlur={async (e) => {
                                const note = e.target.value || null;
                                if (note === it.note) return;
                                setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, note } : x)));
                                await supabase.from("food_group_items").update({ note }).eq("id", it.id);
                              }}
                              placeholder="한 줄 메모"
                              className="w-full rounded border border-transparent bg-transparent px-0.5 text-xs text-gray-500 hover:border-gray-200 focus:border-rose-300 focus:outline-none"
                            />
                          </div>
                          <button onClick={() => removeItem(it)} className="shrink-0 px-1 text-gray-300 hover:text-red-500" aria-label="빼기">
                            ×
                          </button>
                        </li>
                      );
                    })}
                    {list.length === 0 && <li className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400">여기로 장소를 끌어다 놓으세요</li>}
                  </ol>

                  {preview && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-gray-400">게스트에게 나갈 문장</summary>
                      <p className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">{preview}</p>
                    </details>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      )}
    </div>
  );
}

function KeywordInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const parts = draft
      .split(/[,，\n]/)
      .map((k) => k.trim())
      .filter(Boolean)
      .filter((k) => !value.includes(k));
    if (parts.length) onChange([...value, ...parts]);
    setDraft("");
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {value.map((k) => (
        <span key={k} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
          {k}
          <button onClick={() => onChange(value.filter((x) => x !== k))} className="text-rose-400 hover:text-rose-700" aria-label="키워드 삭제">
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={value.length ? "+ 키워드" : "게스트가 물어볼 키워드 (예: 비, rain, 실내)"}
        className="h-6 min-w-32 flex-1 border-0 bg-transparent px-1 text-xs focus:outline-none"
      />
    </div>
  );
}

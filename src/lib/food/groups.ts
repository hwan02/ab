/**
 * 장소 그룹: 호스트가 수집된 장소를 묶은 목록. 답변의 {장소:그룹이름} 을 "문구 + 목록"으로 바꾼다.
 * 그룹마다 자동응답 규칙 1개가 따라다닌다(키워드 = 그룹 키워드, 답변 = {장소:그룹이름}).
 */

import { renderFoodList, type FoodPlace, type Lang } from "./places.ts";

export interface FoodGroup {
  id: string;
  property_id: string;
  name: string;
  intro: string | null;
  keywords: string[];
  sort_order: number;
}

export interface FoodGroupItem {
  id: string;
  group_id: string;
  food_place_id: string;
  note: string | null;
  sort_order: number;
}

export const GROUP_LIST_SIZE = 7;
const GROUP_TOKEN_RE = /\{장소:([^}]+)\}/g;

export function groupVariable(name: string): string {
  return `{장소:${name.trim()}}`;
}

export function hasGroupVariable(text: string): boolean {
  return /\{장소:[^}]+\}/.test(text);
}

/** 그룹 하나를 답장 문장으로: 문구(있으면) + 번호 목록. 항목 메모가 있으면 장소 메모 대신 쓴다. */
export function renderGroup(group: FoodGroup, items: FoodGroupItem[], places: FoodPlace[], lang: Lang, links: boolean | string = false): string {
  const byId = new Map(places.map((p) => [p.id, p]));
  const list = items
    .filter((it) => it.group_id === group.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((it, i) => {
      const p = byId.get(it.food_place_id);
      return p ? { ...p, note: it.note ?? p.note, sort_order: i, hidden: false } : null;
    })
    .filter((p): p is FoodPlace => !!p);
  const body = renderFoodList(list, lang, GROUP_LIST_SIZE, links);
  if (!body) return "";
  return group.intro?.trim() && lang === "ko" ? `${group.intro.trim()}\n${body}` : body;
}

/** 답변 안의 {장소:그룹이름} 을 그룹 목록으로. 없는 그룹·빈 그룹은 지운다. */
export function fillGroupVariables(
  text: string,
  groups: FoodGroup[],
  items: FoodGroupItem[],
  places: FoodPlace[],
  lang: Lang,
  links: boolean | string = false
): string {
  return text
    .replace(GROUP_TOKEN_RE, (_m, name: string) => {
      const g = groups.find((x) => x.name.trim() === name.trim());
      return g ? renderGroup(g, items, places, lang, links) : "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 그룹에 딸린 자동응답 규칙의 내용. */
export function groupRule(group: Pick<FoodGroup, "id" | "property_id" | "name" | "keywords">) {
  return {
    property_id: group.property_id,
    food_group_id: group.id,
    name: `장소 · ${group.name.trim()}`,
    keywords: group.keywords,
    answer: groupVariable(group.name),
    enabled: group.keywords.length > 0,
  };
}

/** 드래그 결과로 새 순서를 매긴다: list 에서 fromId 를 빼서 toIndex 에 넣는다. */
export function reorder<T extends { id: string }>(list: T[], fromId: string, toIndex: number): T[] {
  const from = list.findIndex((x) => x.id === fromId);
  if (from === -1) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved);
  return next;
}

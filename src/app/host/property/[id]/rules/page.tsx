"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RuleTester from "@/components/host/RuleTester";
import FoodLists from "@/components/host/FoodLists";
import { FOOD_VARIABLES } from "@/lib/food/places";
import { removePhotoByUrl, uploadMainPhoto } from "@/lib/propertyPhoto";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  ANSWER_LANG_LABELS,
  ANSWER_VARIABLES,
  protectVariables,
  restoreVariables,
  suggestKeywords,
  type AnswerLang,
} from "@/lib/airbnb/rules";
import type { AirbnbReplyRule, Property } from "@/types/database";

type PropertyBits = Pick<Property, "id" | "name" | "auto_reply_mode" | "airbnb_listing_title">;

const MODE_OPTIONS: { value: PropertyBits["auto_reply_mode"]; label: string }[] = [
  { value: "off", label: "끔" },
  { value: "confirm", label: "확인 후 발송" },
  { value: "auto", label: "자동 발송" },
];

type OtherLang = Exclude<AnswerLang, "ko">;
const OTHER_LANGS: OtherLang[] = ["en", "zh", "ja"];
/** 규칙 목록 행에 보여 줄 키워드 수. 나머지는 +N 으로 접는다. */

/**
 * 한국어 답변을 한 언어로 번역한다. 변수 토큰({게스트이름} 등)은 자리표시로 바꿨다가 복원하고,
 * 복원이 안 되거나 번역이 안 됐으면(미설정·원문 그대로·실패) null.
 */
async function translateAnswer(source: string, target: OtherLang): Promise<string | null> {
  const { text: protectedText, tokens } = protectVariables(source);
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [protectedText], target }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { translations?: unknown };
    const translated = Array.isArray(data.translations) ? data.translations[0] : null;
    if (typeof translated !== "string" || !translated.trim() || translated.trim() === protectedText.trim()) return null;
    return restoreVariables(translated, tokens);
  } catch {
    return null;
  }
}

/** 비어 있는 언어 칸만 번역해 채운다. 호스트가 직접 쓴 번역은 그대로 둔다. */
async function fillMissingTranslations(source: string, current: Record<OtherLang, string>) {
  const values: Record<OtherLang, string> = { ...current };
  const filled: OtherLang[] = [];
  const failed: OtherLang[] = [];
  const missing = OTHER_LANGS.filter((lang) => !current[lang].trim());
  if (!source.trim() || missing.length === 0) return { values, filled, failed };
  const results = await Promise.all(missing.map((lang) => translateAnswer(source, lang)));
  missing.forEach((lang, i) => {
    const t = results[i];
    if (t && t.trim()) {
      values[lang] = t.trim();
      filled.push(lang);
    } else {
      values[lang] = "";
      failed.push(lang);
    }
  });
  return { values, filled, failed };
}

const langNames = (langs: OtherLang[]) => langs.map((l) => ANSWER_LANG_LABELS[l]).join("·");

/** PostgREST 의 "column X does not exist"(PGRST204) 오류이고, 그 컬럼이 columns 중 하나인지. */
function isMissingColumnError(error: { code?: string; message?: string }, columns: string[]): boolean {
  if (error.code !== "PGRST204") return false;
  const msg = error.message ?? "";
  return columns.some((c) => msg.includes(c));
}

type Tab = "list" | "new" | "test" | "food";
const TABS: { key: Tab; label: string }[] = [
  { key: "list", label: "목록" },
  { key: "new", label: "규칙 추가" },
  { key: "food", label: "맛집" },
  { key: "test", label: "미리보기" },
];

const SAMPLE_RULES: { name: string; keywords: string[]; answer: string }[] = [
  {
    name: "와이파이",
    keywords: ["와이파이", "wifi", "wi-fi", "인터넷", "비밀번호"],
    answer: "{게스트이름}님 안녕하세요! 와이파이 이름은 {와이파이이름}, 비밀번호는 {와이파이비밀번호} 입니다. 편하게 이용하세요 :)",
  },
  {
    name: "체크인 시간",
    keywords: ["체크인", "입실", "몇 시", "check in", "check-in"],
    answer: "{게스트이름}님 안녕하세요! 체크인은 {체크인시간}부터 가능합니다. 도착하시면 메시지 주세요 :)",
  },
  {
    name: "체크아웃 시간",
    keywords: ["체크아웃", "퇴실", "check out", "check-out"],
    answer: "체크아웃은 {체크아웃시간}까지입니다. 이용해 주셔서 감사합니다!",
  },
];

export default function RulesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: propertyId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const initialTab = searchParams.get("tab");
  const [tab, setTabState] = useState<Tab>(initialTab === "new" || initialTab === "test" || initialTab === "food" ? initialTab : "list");
  const [testKey, setTestKey] = useState(0);
  const setTab = (t: Tab) => {
    setTabState(t);
    router.replace(`/host/property/${propertyId}/rules${t === "list" ? "" : `?tab=${t}`}`, { scroll: false });
  };

  const [property, setProperty] = useState<PropertyBits | null>(null);
  const [rules, setRules] = useState<AirbnbReplyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 폼
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [answerEn, setAnswerEn] = useState("");
  const [answerZh, setAnswerZh] = useState("");
  const [answerJa, setAnswerJa] = useState("");
  const [othersOpen, setOthersOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [priority, setPriority] = useState("0");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase
        .from("properties")
        .select("id, name, auto_reply_mode, airbnb_listing_title")
        .eq("id", propertyId)
        .single(),
      supabase.from("airbnb_reply_rules").select("*").eq("property_id", propertyId).order("priority", { ascending: false }).order("created_at", { ascending: true }),
    ]);
    setProperty((p as PropertyBits) ?? null);
    setRules((r as AirbnbReplyRule[]) ?? []);
    setLoading(false);
  }, [supabase, propertyId]);

  useEffect(() => {
    load();
  }, [load]);

  // 수신함에서 "규칙으로 만들기"로 들어온 경우: 키워드 후보를 미리 채운다
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && keywords.length === 0 && !editingId) setKeywords(suggestKeywords(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setKeywordInput("");
    setKeywords([]);
    setAnswer("");
    setAnswerEn("");
    setAnswerZh("");
    setAnswerJa("");
    setOthersOpen(false);
    setPriority("0");
    setPhotoUrl(null);
  };

  const otherAnswers: Record<OtherLang, string> = { en: answerEn, zh: answerZh, ja: answerJa };
  const setOtherAnswer = (lang: OtherLang, value: string) => {
    if (lang === "en") setAnswerEn(value);
    else if (lang === "zh") setAnswerZh(value);
    else setAnswerJa(value);
  };

  /** "번역해서 채우기": 비어 있는 언어 칸만 한국어 답변으로 채운다. */
  const translateIntoForm = async () => {
    if (!answer.trim()) return flash("한국어 답변이 비어 있습니다.");
    const missing = OTHER_LANGS.filter((lang) => !otherAnswers[lang].trim());
    if (missing.length === 0) return flash("비어 있는 언어 칸이 없습니다.");
    setTranslating(true);
    const { values, filled, failed } = await fillMissingTranslations(answer.trim(), otherAnswers);
    setTranslating(false);
    OTHER_LANGS.forEach((lang) => setOtherAnswer(lang, values[lang]));
    setOthersOpen(true);
    if (failed.length > 0 && filled.length === 0) return flash(`번역 실패: ${langNames(failed)}`);
    if (failed.length > 0) return flash(`${langNames(filled)} 채움. ${langNames(failed)} 번역 실패.`);
    flash(`${langNames(filled)} 답변을 채웠습니다.`);
  };

  const addKeywordsFromInput = () => {
    const parts = keywordInput
      .split(/[,，\n]/)
      .map((k) => k.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setKeywords((prev) => [...prev, ...parts.filter((k) => !prev.includes(k))]);
    setKeywordInput("");
  };

  const startEdit = (rule: AirbnbReplyRule) => {
    setEditingId(rule.id);
    setName(rule.name);
    setKeywords(rule.keywords);
    setKeywordInput("");
    setAnswer(rule.answer);
    setAnswerEn(rule.answer_en ?? "");
    setAnswerZh(rule.answer_zh ?? "");
    setAnswerJa(rule.answer_ja ?? "");
    setOthersOpen(!!(rule.answer_en || rule.answer_zh || rule.answer_ja));
    setPriority(String(rule.priority));
    setPhotoUrl(rule.photo_url ?? null);
    setTab("new");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const pendingKeywords = keywordInput.trim()
      ? [...keywords, ...keywordInput.split(/[,，\n]/).map((k) => k.trim()).filter(Boolean)]
      : keywords;
    if (!name.trim() || pendingKeywords.length === 0 || !answer.trim()) {
      return flash("규칙 이름, 키워드 1개 이상, 답변이 필요합니다.");
    }
    setSaving(true);
    // 비어 있는 언어 칸은 한국어 답변을 번역해 채운다. 호스트가 쓴 번역은 그대로.
    const { values, failed } = await fillMissingTranslations(answer.trim(), {
      en: answerEn.trim(),
      zh: answerZh.trim(),
      ja: answerJa.trim(),
    });
    const payload = {
      property_id: propertyId,
      name: name.trim(),
      keywords: pendingKeywords,
      answer: answer.trim(),
      answer_en: values.en || null,
      answer_zh: values.zh || null,
      answer_ja: values.ja || null,
      priority: Number(priority) || 0,
      photo_url: photoUrl,
      updated_at: new Date().toISOString(),
    };
    const save = (row: Partial<typeof payload>) =>
      editingId ? supabase.from("airbnb_reply_rules").update(row).eq("id", editingId) : supabase.from("airbnb_reply_rules").insert(row);
    let { error } = await save(payload);
    // 배포 순서: 마이그레이션(20261023_reply_rules_i18n.sql)을 먼저 적용해야 answer_zh/answer_ja 컬럼이 있다.
    // 아직 없는 DB(PGRST204: column does not exist)면 두 칸을 빼고 한 번 더 저장해 규칙 추가·수정 자체는 되게 한다.
    let droppedPhoto = false;
    if (error && isMissingColumnError(error, ["photo_url"])) {
      const { photo_url: _p, ...noPhoto } = payload; // eslint-disable-line @typescript-eslint/no-unused-vars
      ({ error } = await save(noPhoto));
      droppedPhoto = !error;
    }
    let droppedZhJa = false;
    if (error && isMissingColumnError(error, ["answer_zh", "answer_ja"])) {
      const { answer_zh: _zh, answer_ja: _ja, ...legacy } = payload; // eslint-disable-line @typescript-eslint/no-unused-vars
      ({ error } = await save(legacy));
      droppedZhJa = !error;
    }
    setSaving(false);
    if (error) return flash("저장 실패: " + error.message);
    let note = failed.length > 0 ? ` ${langNames(failed)} 번역 실패.` : "";
    if (droppedZhJa) note += " 중국어·일본어 답변은 저장되지 않았습니다(DB 마이그레이션 필요).";
    if (droppedPhoto) note += " 사진은 저장되지 않았습니다(DB 마이그레이션 필요).";
    flash((editingId ? "규칙을 수정했습니다." : "규칙을 추가했습니다.") + note);
    resetForm();
    load();
    setTestKey((k) => k + 1);
    setTab("list");
  };

  const toggleRule = async (rule: AirbnbReplyRule) => {
    const { error } = await supabase.from("airbnb_reply_rules").update({ enabled: !rule.enabled }).eq("id", rule.id);
    if (error) return flash("변경 실패: " + error.message);
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)));
  };

  const deleteRule = async (rule: AirbnbReplyRule) => {
    if (!confirm(`"${rule.name}" 규칙을 삭제할까요?`)) return;
    const { error } = await supabase.from("airbnb_reply_rules").delete().eq("id", rule.id);
    if (error) return flash("삭제 실패: " + error.message);
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
  };

  const addSamples = async () => {
    const rows = SAMPLE_RULES.map((s) => ({ property_id: propertyId, ...s, enabled: false }));
    const { error } = await supabase.from("airbnb_reply_rules").insert(rows);
    if (error) return flash("추가 실패: " + error.message);
    flash("기본 규칙 3개를 꺼진 상태로 추가했습니다.");
    load();
  };

  const setMode = async (mode: PropertyBits["auto_reply_mode"]) => {
    if (mode === property?.auto_reply_mode) return;
    const { error } = await supabase.from("properties").update({ auto_reply_mode: mode }).eq("id", propertyId);
    if (error) return flash("설정 실패: " + error.message);
    setProperty((p) => (p ? { ...p, auto_reply_mode: mode } : p));
  };

  const onPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const url = user ? await uploadMainPhoto(supabase, user.id, file) : null;
    setUploading(false);
    if (!url) return flash("사진 업로드 실패");
    setPhotoUrl(url);
  };

  const removePhoto = async () => {
    const old = photoUrl;
    setPhotoUrl(null);
    if (old && !rules.some((r) => r.photo_url === old && r.id !== editingId)) await removePhotoByUrl(supabase, old);
  };

  const insertVariable = (token: string) => setAnswer((a) => (a ? `${a} ${token}` : token));

  const visibleRules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter((r) => r.name.toLowerCase().includes(q) || r.keywords.some((k) => k.toLowerCase().includes(q)) || r.answer.toLowerCase().includes(q));
  }, [rules, query]);

  const PAGE_SIZE = 10;
  const pageCount = Math.max(1, Math.ceil(visibleRules.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pagedRules = visibleRules.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  if (loading) return <div className="p-8 text-sm text-gray-500">불러오는 중...</div>;
  if (!property) return <div className="p-8 text-sm text-red-600">숙소를 찾을 수 없습니다.</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">자동응답</h1>
        {notice && <span className="text-xs text-rose-600">{notice}</span>}
      </div>

      {!property.airbnb_listing_title && (
        <p className="mb-4 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-700">
          숙소 정보의 에어비앤비 리스팅 제목이 비어 있어 메일이 이 숙소에 연결되지 않습니다.
        </p>
      )}

      {/* 모드 */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">자동응답 모드</span>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1" role="radiogroup" aria-label="자동응답 모드">
          {MODE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={property.auto_reply_mode === o.value}
              onClick={() => setMode(o.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                property.auto_reply_mode === o.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 */}
      <div className="mb-5 flex gap-6 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              if (t.key === "new" && tab !== "new") resetForm();
              setTab(t.key);
            }}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors",
              tab === t.key ? "border-rose-500 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"
            )}
          >
            {t.key === "new" && editingId ? "규칙 수정" : t.label}
            {t.key === "list" && <span className="ml-1 text-xs text-gray-400">{rules.length}</span>}
          </button>
        ))}
      </div>

      {tab === "test" && <RuleTester propertyId={propertyId} refreshKey={testKey} />}
      {tab === "food" && <FoodLists propertyId={propertyId} />}

      {/* 규칙 폼 */}
      {tab === "new" && (
      <Card className="mb-6">
        <form onSubmit={saveRule} className="space-y-4">
          <Input label="규칙 이름" placeholder="예) 와이파이 안내" value={name} onChange={(e) => setName(e.target.value)} />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">키워드</label>
            {keywords.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {keywords.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-700">
                    {k}
                    <button type="button" onClick={() => setKeywords((prev) => prev.filter((x) => x !== k))} className="text-rose-400 hover:text-rose-700" aria-label="키워드 삭제">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input
              placeholder="쉼표나 엔터로 추가. 예) 와이파이, wifi, 비밀번호"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addKeywordsFromInput();
                }
              }}
              onBlur={addKeywordsFromInput}
            />
          </div>

          <div>
            <Textarea label="답변 (한국어)" placeholder="게스트에게 그대로 보낼 문장" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {ANSWER_VARIABLES.map((v) => (
                <button key={v} type="button" onClick={() => insertVariable(v)} className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50">
                  {v}
                </button>
              ))}
              {FOOD_VARIABLES.map((v) => (
                <button key={v} type="button" onClick={() => insertVariable(v)} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 hover:bg-amber-100">
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* 사진 (답장 끝에 링크로 붙는다) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">사진</label>
            {photoUrl ? (
              <div className="flex items-center gap-3">
                <img src={photoUrl} alt="" className="h-20 w-28 rounded-lg border border-gray-200 object-cover" />
                <button type="button" onClick={removePhoto} className="text-xs text-gray-500 hover:text-red-600">
                  삭제
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                onChange={onPhotoChange}
                disabled={uploading}
                className="block text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-rose-600 hover:file:bg-rose-100 disabled:opacity-50"
              />
            )}
            {uploading && <p className="mt-1 text-xs text-gray-400">올리는 중...</p>}
          </div>

          {/* 다른 언어 답변 */}
          <div className="rounded-lg border border-gray-200">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <button type="button" onClick={() => setOthersOpen((o) => !o)} className="flex items-center gap-1.5 text-sm font-medium text-gray-700" aria-expanded={othersOpen}>
                <span className={cn("inline-block transition-transform", othersOpen && "rotate-90")}>▸</span>
                다른 언어 답변
                <span className="text-xs font-normal text-gray-400">
                  {OTHER_LANGS.filter((l) => otherAnswers[l].trim()).length}/{OTHER_LANGS.length} 채움
                </span>
              </button>
              <Button type="button" size="sm" variant="secondary" loading={translating} onClick={translateIntoForm}>
                번역해서 채우기
              </Button>
            </div>
            {othersOpen && (
              <div className="space-y-3 border-t border-gray-200 px-3 py-3">
                {OTHER_LANGS.map((lang) => (
                  <Textarea
                    key={lang}
                    label={`${ANSWER_LANG_LABELS[lang]} 답변`}
                    placeholder="비워 두면 저장할 때 자동 번역"
                    value={otherAnswers[lang]}
                    onChange={(e) => setOtherAnswer(lang, e.target.value)}
                    rows={3}
                  />
                ))}
              </div>
            )}
          </div>

          <details className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <summary className="cursor-pointer text-xs text-gray-500">고급</summary>
            <div className="mt-2 max-w-xs">
              <Input label="먼저 보낼 순서" type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
              <p className="mt-1 text-xs text-gray-400">한 메시지에 규칙이 여러 개 걸리면 숫자가 큰 규칙의 답을 보냅니다. 보통 0.</p>
            </div>
          </details>

          <div className="flex justify-end gap-2">
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetForm();
                  setTab("list");
                }}
              >
                취소
              </Button>
            )}
            <Button type="submit" loading={saving}>
              {editingId ? "수정 저장" : "규칙 추가"}
            </Button>
          </div>
        </form>
      </Card>
      )}

      {/* 목록 */}
      {tab === "list" && (
      <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="검색"
            className="h-8 w-40 rounded-lg border border-gray-200 px-2.5 text-sm focus:border-rose-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1">
          {rules.length === 0 && (
            <Button size="sm" variant="ghost" onClick={addSamples}>
              기본 규칙 넣기
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setTab("new");
            }}
          >
            + 규칙 추가
          </Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <Card className="py-10 text-center text-sm text-gray-500">아직 규칙이 없습니다</Card>
      ) : (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {pagedRules.map((rule) => {
            const open = openId === rule.id;
            return (
              <div key={rule.id} className={cn(!rule.enabled && "bg-gray-50")}>
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <button onClick={() => setOpenId(open ? null : rule.id)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("truncate text-sm font-medium", rule.enabled ? "text-gray-900" : "text-gray-400")}>{rule.name}</span>
                      {rule.photo_url && <span className="shrink-0 rounded bg-gray-100 px-1.5 text-[10px] text-gray-500">사진</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-gray-400">
                      {rule.keywords.slice(0, 4).join(", ")}
                      {rule.keywords.length > 4 && ` 외 ${rule.keywords.length - 4}개`}
                    </span>
                  </button>
                  <label className="flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" checked={rule.enabled} onChange={() => toggleRule(rule)} className="h-4 w-4 accent-rose-500" aria-label="사용" />
                  </label>
                </div>
                {open && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="whitespace-pre-wrap text-sm text-gray-700">{rule.answer}</p>
                    <div className="mt-3 flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => startEdit(rule)}>
                        편집
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteRule(rule)}>
                        삭제
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {visibleRules.length === 0 && <div className="px-4 py-6 text-center text-sm text-gray-400">검색 결과 없음</div>}
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1">
          <button
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 0}
            className="h-8 rounded-lg px-3 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            이전
          </button>
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={cn("h-8 w-8 rounded-lg text-sm", i === currentPage ? "bg-rose-500 font-medium text-white" : "text-gray-600 hover:bg-gray-100")}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === pageCount - 1}
            className="h-8 rounded-lg px-3 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            다음
          </button>
        </div>
      )}
      </>
      )}
    </div>
  );
}

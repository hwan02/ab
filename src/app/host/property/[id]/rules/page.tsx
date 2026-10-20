"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import {
  ANSWER_LANG_LABELS,
  ANSWER_VARIABLES,
  detectLanguage,
  matchRule,
  pickAnswerWithLang,
  protectVariables,
  renderAnswer,
  restoreVariables,
  suggestKeywords,
  type AnswerLang,
  type ReplyRule,
} from "@/lib/airbnb/rules";
import type { AirbnbReplyRule, Property } from "@/types/database";
import { PRODUCT_NAME } from "@/lib/airbnb/brand";

type PropertyBits = Pick<
  Property,
  "id" | "name" | "auto_reply_mode" | "wifi_ssid" | "wifi_password" | "checkin_time" | "checkout_time" | "address" | "airbnb_listing_title"
>;

const MODE_OPTIONS = [
  { value: "confirm", label: "확인 후 발송 (답변을 채워 두고 호스트가 보내기)" },
  { value: "auto", label: "자동 발송 (매칭되면 바로 보냄)" },
  { value: "off", label: "끔 (매칭 안 함)" },
];

type OtherLang = Exclude<AnswerLang, "ko">;
const OTHER_LANGS: OtherLang[] = ["en", "zh", "ja"];
const OTHER_LANG_FIELD: Record<OtherLang, "answer_en" | "answer_zh" | "answer_ja"> = { en: "answer_en", zh: "answer_zh", ja: "answer_ja" };
const OTHER_LANG_BADGE: Record<OtherLang, string> = { en: "EN", zh: "中", ja: "日" };

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

const SAMPLE_RULES: { name: string; keywords: string[]; answer: string }[] = [
  {
    name: "와이파이 안내",
    keywords: ["와이파이", "wifi", "wi-fi", "인터넷", "비밀번호"],
    answer: "{게스트이름}님 안녕하세요! 와이파이 이름은 {와이파이이름}, 비밀번호는 {와이파이비밀번호} 입니다. 편하게 이용하세요 :)",
  },
  {
    name: "체크인 안내",
    keywords: ["체크인", "입실", "몇 시", "check in", "check-in"],
    answer: "{게스트이름}님 안녕하세요! 체크인은 {체크인시간}부터 가능합니다. 도착하시면 메시지 주세요 :)",
  },
  {
    name: "체크아웃 안내",
    keywords: ["체크아웃", "퇴실", "check out", "check-out"],
    answer: "체크아웃은 {체크아웃시간}까지입니다. 이용해 주셔서 감사합니다!",
  },
];

export default function RulesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: propertyId } = use(params);
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

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

  // 테스트 박스
  const [testMessage, setTestMessage] = useState(searchParams.get("q") ?? "");

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase
        .from("properties")
        .select("id, name, auto_reply_mode, wifi_ssid, wifi_password, checkin_time, checkout_time, address, airbnb_listing_title")
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
  };

  const otherAnswers: Record<OtherLang, string> = { en: answerEn, zh: answerZh, ja: answerJa };
  const setOtherAnswer = (lang: OtherLang, value: string) => {
    if (lang === "en") setAnswerEn(value);
    else if (lang === "zh") setAnswerZh(value);
    else setAnswerJa(value);
  };

  /** "번역해서 채우기": 비어 있는 언어 칸만 한국어 답변으로 채운다. */
  const translateIntoForm = async () => {
    if (!answer.trim()) return flash("먼저 한국어 답변을 써 주세요.");
    const missing = OTHER_LANGS.filter((lang) => !otherAnswers[lang].trim());
    if (missing.length === 0) return flash("다른 언어 답변이 모두 채워져 있습니다. 비운 칸만 번역합니다.");
    setTranslating(true);
    const { values, filled, failed } = await fillMissingTranslations(answer.trim(), otherAnswers);
    setTranslating(false);
    OTHER_LANGS.forEach((lang) => setOtherAnswer(lang, values[lang]));
    setOthersOpen(true);
    if (failed.length > 0 && filled.length === 0) return flash(`번역하지 못했습니다(${langNames(failed)}). 번역 설정을 확인하거나 직접 써 주세요.`);
    if (failed.length > 0) return flash(`${langNames(filled)} 답변을 채웠습니다. ${langNames(failed)}은 번역하지 못해 비워 뒀습니다.`);
    flash(`${langNames(filled)} 답변을 채웠습니다. 내용을 확인해 주세요.`);
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
      updated_at: new Date().toISOString(),
    };
    const { error } = editingId
      ? await supabase.from("airbnb_reply_rules").update(payload).eq("id", editingId)
      : await supabase.from("airbnb_reply_rules").insert(payload);
    setSaving(false);
    if (error) return flash("저장 실패: " + error.message);
    const note = failed.length > 0 ? ` ${langNames(failed)} 답변은 번역하지 못해 비워 뒀습니다.` : "";
    flash((editingId ? "규칙을 수정했습니다." : "규칙을 추가했습니다.") + note);
    resetForm();
    load();
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
    flash("기본 규칙 3개를 꺼진 상태로 추가했습니다. 답변을 다듬고 켜 주세요.");
    load();
  };

  const importFaqs = async () => {
    const { data: faqs } = await supabase.from("faqs").select("question, answer");
    if (!faqs || faqs.length === 0) return flash("가져올 FAQ가 없습니다.");
    const rows = faqs.map((f) => ({
      property_id: propertyId,
      name: f.question.slice(0, 40),
      keywords: suggestKeywords(f.question),
      answer: f.answer,
      enabled: false,
    }));
    const { error } = await supabase.from("airbnb_reply_rules").insert(rows);
    if (error) return flash("가져오기 실패: " + error.message);
    flash(`FAQ ${rows.length}개를 꺼진 상태로 가져왔습니다. 키워드를 확인하고 켜 주세요.`);
    load();
  };

  const setMode = async (mode: string) => {
    const { error } = await supabase.from("properties").update({ auto_reply_mode: mode }).eq("id", propertyId);
    if (error) return flash("설정 실패: " + error.message);
    setProperty((p) => (p ? { ...p, auto_reply_mode: mode as PropertyBits["auto_reply_mode"] } : p));
    flash("자동응답 모드를 바꿨습니다.");
  };

  const insertVariable = (token: string) => setAnswer((a) => (a ? `${a} ${token}` : token));

  // 테스트: 저장된 규칙 + 지금 편집 중인 폼 내용까지 포함해서 미리 본다
  const testResult = useMemo(() => {
    if (!testMessage.trim()) return null;
    const draftRule: ReplyRule | null =
      name.trim() && (keywords.length > 0 || keywordInput.trim()) && answer.trim()
        ? {
            id: editingId ?? "__draft__",
            property_id: propertyId,
            name: name.trim() + (editingId ? "" : " (저장 전)"),
            keywords: keywordInput.trim() ? [...keywords, ...keywordInput.split(/[,，\n]/).map((k) => k.trim()).filter(Boolean)] : keywords,
            answer: answer.trim(),
            answer_en: answerEn.trim() || null,
            answer_zh: answerZh.trim() || null,
            answer_ja: answerJa.trim() || null,
            priority: Number(priority) || 0,
            enabled: true,
          }
        : null;
    const pool: ReplyRule[] = [...rules.filter((r) => r.id !== editingId), ...(draftRule ? [draftRule] : [])];
    const detected = detectLanguage(testMessage);
    const m = matchRule(testMessage, pool);
    if (!m) return { matched: null as null | ReplyRule, text: "", detected, answerLang: detected };
    const picked = pickAnswerWithLang(m.rule, testMessage);
    const text = renderAnswer(picked.text, {
      guestName: "게스트",
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
  }, [testMessage, rules, name, keywords, keywordInput, answer, answerEn, answerZh, answerJa, priority, editingId, property, propertyId]);

  if (loading) return <div className="p-8 text-sm text-gray-500">불러오는 중...</div>;
  if (!property) return <div className="p-8 text-sm text-red-600">숙소를 찾을 수 없습니다.</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{PRODUCT_NAME} 자동응답 규칙</h1>
          <p className="mt-1 text-sm text-gray-500">에어비앤비 게스트 메시지에 키워드가 들어 있으면 등록한 답변을 그대로 보냅니다.</p>
        </div>
        {notice && <span className="text-xs text-rose-600">{notice}</span>}
      </div>

      {!property.airbnb_listing_title && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          숙소 정보에 <b>에어비앤비 리스팅 제목</b>이 비어 있습니다. 제목이 있어야 알림 메일을 이 숙소로 연결할 수 있습니다.
        </div>
      )}

      {/* 설정 */}
      <Card className="mb-6">
        <Select label="자동응답 모드" options={MODE_OPTIONS} value={property.auto_reply_mode} onChange={(e) => setMode(e.target.value)} />
        <p className="mt-2 text-xs text-gray-400">
          처음에는 “확인 후 발송”으로 두고 며칠 지켜본 뒤 “자동 발송”으로 바꾸는 것을 권장합니다. 매칭되지 않은 메시지는 항상 수신함에 “답변 필요”로 남습니다.
        </p>
      </Card>

      {/* 규칙 폼 */}
      <Card className="mb-6" title={editingId ? "규칙 수정" : "규칙 추가"}>
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
            <p className="mt-1 text-xs text-gray-400">
              대소문자와 띄어쓰기는 무시합니다. 하나라도 들어 있으면 매칭됩니다. 영어 키워드는 단어 단위로 맞추고(“check in”은 “checking”에 안 걸림), 한글 한 글자 키워드는 앞뒤가 한글이 아닐 때만 걸립니다.
            </p>
          </div>

          <div>
            <Textarea label="답변" placeholder="게스트에게 그대로 보낼 문장" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {ANSWER_VARIABLES.map((v) => (
                <button key={v} type="button" onClick={() => insertVariable(v)} className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50">
                  {v}
                </button>
              ))}
            </div>
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
                <p className="text-xs text-gray-400">
                  게스트 원문이 영어·중국어·일본어면 그 언어의 답변을 보냅니다. 비워 두고 저장하면 한국어 답변을 자동 번역해 채우고, 직접 쓴 답변은 덮어쓰지 않습니다. 그 언어 답변이 없으면 영어, 영어도 없으면 한국어 답변을 보냅니다.
                </p>
                {OTHER_LANGS.map((lang) => (
                  <Textarea
                    key={lang}
                    label={`${ANSWER_LANG_LABELS[lang]} 답변`}
                    placeholder={`비워 두면 저장할 때 한국어 답변을 ${ANSWER_LANG_LABELS[lang]}로 번역해 채웁니다`}
                    value={otherAnswers[lang]}
                    onChange={(e) => setOtherAnswer(lang, e.target.value)}
                    rows={3}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="우선순위" type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
            <p className="self-end pb-2 text-xs text-gray-400">여러 규칙이 동시에 걸리면 숫자가 큰 규칙을 보냅니다.</p>
          </div>

          <div className="flex justify-end gap-2">
            {editingId && (
              <Button type="button" variant="ghost" onClick={resetForm}>
                취소
              </Button>
            )}
            <Button type="submit" loading={saving}>
              {editingId ? "수정 저장" : "규칙 추가"}
            </Button>
          </div>
        </form>
      </Card>

      {/* 테스트 */}
      <Card className="mb-6" title="테스트" description="게스트가 이렇게 보내면 어떤 답이 나가는지 미리 봅니다. 영어·중국어·일본어 원문도 넣어 보세요.">
        <Textarea placeholder="예) 혹시 와이파이 비밀번호가 뭔가요?" value={testMessage} onChange={(e) => setTestMessage(e.target.value)} rows={2} />
        {testResult && (
          <div className={cn("mt-3 rounded-lg px-4 py-3 text-sm", testResult.matched ? "bg-emerald-50 text-emerald-900" : "bg-gray-50 text-gray-600")}>
            <p className={cn("mb-1 text-xs", testResult.matched ? "text-emerald-700" : "text-gray-500")}>
              감지 언어: <b>{ANSWER_LANG_LABELS[testResult.detected]}</b>
              {testResult.matched && (
                <>
                  {" · "}
                  나가는 답변: <b>{ANSWER_LANG_LABELS[testResult.answerLang]}</b>
                  {testResult.answerLang !== testResult.detected && ` (${ANSWER_LANG_LABELS[testResult.detected]} 답변이 없어 대신 보냄)`}
                </>
              )}
            </p>
            {testResult.matched ? (
              <>
                <p className="mb-1 text-xs font-medium text-emerald-700">매칭: {testResult.matched.name}</p>
                <p className="whitespace-pre-wrap">{testResult.text}</p>
              </>
            ) : (
              <p>매칭되는 규칙이 없습니다. 이 메시지는 수신함에 “답변 필요”로 남습니다.</p>
            )}
          </div>
        )}
      </Card>

      {/* 목록 */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">규칙 {rules.length}개</h2>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={importFaqs}>
            FAQ에서 가져오기
          </Button>
          <Button size="sm" variant="ghost" onClick={addSamples}>
            기본 규칙 추가
          </Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <Card className="py-10 text-center text-sm text-gray-500">아직 규칙이 없습니다. 위에서 추가하거나 기본 규칙을 넣어 보세요.</Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <Card key={rule.id} className={cn("p-4", !rule.enabled && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{rule.name}</span>
                    <span className="text-[11px] text-gray-400">우선순위 {rule.priority}</span>
                    {rule.hit_count > 0 && <span className="text-[11px] text-gray-400">· 발송 {rule.hit_count}회</span>}
                    {!rule.enabled && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">꺼짐</span>}
                    {OTHER_LANGS.filter((l) => rule[OTHER_LANG_FIELD[l]]?.trim()).map((l) => (
                      <span key={l} className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700" title={`${ANSWER_LANG_LABELS[l]} 답변 있음`}>
                        {OTHER_LANG_BADGE[l]}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {rule.keywords.map((k) => (
                      <span key={k} className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">
                        {k}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-gray-600">{rule.answer}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
                    <input type="checkbox" checked={rule.enabled} onChange={() => toggleRule(rule)} className="h-4 w-4 accent-rose-500" />
                    사용
                  </label>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(rule)} className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">
                      편집
                    </button>
                    <button onClick={() => deleteRule(rule)} className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600">
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

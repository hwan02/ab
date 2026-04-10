"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import Header from "@/components/layout/Header";
import type { Faq } from "@/types/database";

export default function HostFaqPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  const loadFaqs = useCallback(async () => {
    const { data } = await supabase
      .from("faqs")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setFaqs((data as Faq[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    loadFaqs();
  }, [loadFaqs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setSubmitting(true);

    if (editingId) {
      await supabase.from("faqs").update({ question: question.trim(), answer: answer.trim() }).eq("id", editingId);
    } else {
      await supabase.from("faqs").insert({ question: question.trim(), answer: answer.trim() });
    }

    setQuestion("");
    setAnswer("");
    setEditingId(null);
    setSubmitting(false);
    loadFaqs();
  };

  const handleEdit = (faq: Faq) => {
    setEditingId(faq.id);
    setQuestion(faq.question);
    setAnswer(faq.answer);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("common.delete") + "?")) return;
    await supabase.from("faqs").delete().eq("id", id);
    loadFaqs();
  };

  return (
    <div className="min-h-dvh bg-gray-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">{t("faq.title")} {t("common.edit")}</h1>

        {/* Add/Edit form */}
        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label={t("faq.questionLabel")}
              placeholder={t("faq.questionPlaceholder")}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
            />
            <Textarea
              label={t("faq.answerLabel")}
              placeholder={t("faq.answerPlaceholder")}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={() => { setEditingId(null); setQuestion(""); setAnswer(""); }}
                  className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
                >
                  {t("common.cancel")}
                </button>
              )}
              <Button type="submit" loading={submitting}>
                {editingId ? t("common.update") : t("common.add")}
              </Button>
            </div>
          </form>
        </Card>

        {/* FAQ list */}
        <div className="space-y-3">
          {faqs.map((faq) => (
            <Card key={faq.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{faq.question}</p>
                  <p className="mt-1 text-sm text-gray-500">{faq.answer}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => handleEdit(faq)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(faq.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

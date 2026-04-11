import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/layout/Header";
import FaqContent from "@/components/faq/FaqContent";
import type { Faq } from "@/types/database";

export default async function FaqPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: faqs } = await supabase
    .from("faqs")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-dvh bg-gray-50">
      <Header />
      <FaqContent customFaqs={(faqs as Faq[]) ?? []} />
    </div>
  );
}

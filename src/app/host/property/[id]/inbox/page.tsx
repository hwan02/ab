import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PropertyInbox from "@/components/host/PropertyInbox";
import type { AirbnbInboundMail } from "@/types/database";

export const dynamic = "force-dynamic";

/** 숙소 수신함. 이 숙소에 매핑된 메일만(RLS 로 호스트 본인 숙소만 읽힌다). */
export default async function PropertyInboxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: mails } = await supabase
    .from("airbnb_inbound_mails")
    .select("*")
    .eq("property_id", id)
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(200);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">수신함</h1>
      <PropertyInbox initialMails={(mails ?? []) as AirbnbInboundMail[]} />
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Header from "@/components/layout/Header";
import AirbnbInbox from "@/components/host/AirbnbInbox";
import type { AirbnbInboundMail, Property } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function HostAirbnbPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isAdmin = !!process.env.NEXT_PUBLIC_ADMIN_EMAIL && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  // 관리자는 매핑 안 된 메일까지 전부, 호스트는 RLS 대로 자기 숙소 메일만
  const reader = isAdmin ? createAdminClient() : supabase;

  const [{ data: mails }, { data: properties }, { data: rules }] = await Promise.all([
    reader
      .from("airbnb_inbound_mails")
      .select("*")
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(100),
    isAdmin ? reader.from("properties").select("id, name") : supabase.from("properties").select("id, name").eq("host_id", user.id),
    reader.from("airbnb_reply_rules").select("id, name"),
  ]);

  const propertyList = (properties ?? []) as Pick<Property, "id" | "name">[];

  return (
    <div className="min-h-dvh bg-gray-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">에어비앤비 수신함</h1>
            <p className="mt-1 text-sm text-gray-500">게스트 메시지와 자동응답 결과입니다. 매칭되지 않은 메시지는 직접 답하거나 규칙으로 만들 수 있습니다.</p>
          </div>
          {propertyList.length === 1 && (
            <Link href={`/host/property/${propertyList[0].id}/rules`} className="text-sm font-medium text-rose-600 hover:underline">
              자동응답 규칙 관리 →
            </Link>
          )}
        </div>
        <AirbnbInbox
          initialMails={(mails ?? []) as AirbnbInboundMail[]}
          properties={propertyList}
          rules={(rules ?? []) as { id: string; name: string }[]}
        />
      </main>
    </div>
  );
}

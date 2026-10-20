import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Header from "@/components/layout/Header";
import AirbnbInbox from "@/components/host/AirbnbInbox";
import { UNMAPPED_FILTER } from "@/lib/airbnb/sync";
import type { AirbnbInboundMail, Property } from "@/types/database";
import { PRODUCT_NAME } from "@/lib/airbnb/brand";

export const dynamic = "force-dynamic";

/**
 * 수신함. ?property=<숙소 id> 로 숙소를 고르고, 관리자는 ?property=unmapped 로 숙소가 안 붙은 메일만 본다.
 * 호스트는 자기 숙소만 고를 수 있고(RLS 로 메일도 자기 숙소 것만), 모르는 값은 '전체'로 본다.
 */
export default async function HostAirbnbPage({ searchParams }: { searchParams: Promise<{ property?: string | string[] }> }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isAdmin = !!process.env.NEXT_PUBLIC_ADMIN_EMAIL && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  // 관리자는 매핑 안 된 메일까지 전부, 호스트는 RLS 대로 자기 숙소 메일만
  const reader = isAdmin ? createAdminClient() : supabase;

  const { data: properties } = isAdmin
    ? await reader.from("properties").select("id, name").order("name")
    : await supabase.from("properties").select("id, name").eq("host_id", user.id).order("name");
  const propertyList = (properties ?? []) as Pick<Property, "id" | "name">[];

  const raw = (await searchParams).property;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  let selected = "";
  if (requested === UNMAPPED_FILTER && isAdmin) selected = UNMAPPED_FILTER;
  else if (requested && propertyList.some((p) => p.id === requested)) selected = requested;

  let mailQuery = reader.from("airbnb_inbound_mails").select("*");
  if (selected === UNMAPPED_FILTER) mailQuery = mailQuery.is("property_id", null);
  else if (selected) mailQuery = mailQuery.eq("property_id", selected);

  const [{ data: mails }, { data: rules }] = await Promise.all([
    mailQuery.order("received_at", { ascending: false, nullsFirst: false }).limit(100),
    reader.from("airbnb_reply_rules").select("id, name"),
  ]);

  const rulesLinkProperty = selected && selected !== UNMAPPED_FILTER ? selected : propertyList.length === 1 ? propertyList[0].id : null;

  return (
    <div className="min-h-dvh bg-gray-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{PRODUCT_NAME} 수신함</h1>
            <p className="mt-1 text-sm text-gray-500">에어비앤비 게스트 메시지와 자동응답 결과입니다. 매칭되지 않은 메시지는 직접 답하거나 규칙으로 만들 수 있습니다.</p>
          </div>
          {rulesLinkProperty && (
            <Link href={`/host/property/${rulesLinkProperty}/rules`} className="text-sm font-medium text-rose-600 hover:underline">
              자동응답 규칙 관리 →
            </Link>
          )}
        </div>
        <AirbnbInbox
          key={selected || "all"}
          initialMails={(mails ?? []) as AirbnbInboundMail[]}
          properties={propertyList}
          rules={(rules ?? []) as { id: string; name: string }[]}
          selectedProperty={selected}
          isAdmin={isAdmin}
        />
      </main>
    </div>
  );
}

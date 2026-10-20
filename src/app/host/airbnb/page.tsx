import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Header from "@/components/layout/Header";
import PropertyInbox from "@/components/host/PropertyInbox";
import { UNMAPPED_FILTER } from "@/lib/airbnb/sync";
import { cn } from "@/lib/utils";
import type { AirbnbInboundMail, Property } from "@/types/database";
import { PRODUCT_NAME } from "@/lib/airbnb/brand";

export const dynamic = "force-dynamic";

/**
 * 관리자(NEXT_PUBLIC_ADMIN_EMAIL) 전용 전체 수신함. 호스트는 숙소별 수신함(/host/property/[id]/inbox)을 쓴다.
 * ?property=<숙소 id> 로 숙소를 고르고, ?property=unmapped 로 숙소가 안 붙은 메일만 본다.
 */
export default async function HostAirbnbPage({ searchParams }: { searchParams: Promise<{ property?: string | string[] }> }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isAdmin = !!process.env.NEXT_PUBLIC_ADMIN_EMAIL && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  if (!isAdmin) redirect("/host");

  const reader = createAdminClient();
  const { data: properties } = await reader.from("properties").select("id, name").order("name");
  const propertyList = (properties ?? []) as Pick<Property, "id" | "name">[];

  const raw = (await searchParams).property;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  let selected = "";
  if (requested === UNMAPPED_FILTER) selected = UNMAPPED_FILTER;
  else if (requested && propertyList.some((p) => p.id === requested)) selected = requested;

  let mailQuery = reader.from("airbnb_inbound_mails").select("*");
  if (selected === UNMAPPED_FILTER) mailQuery = mailQuery.is("property_id", null);
  else if (selected) mailQuery = mailQuery.eq("property_id", selected);
  const { data: mails } = await mailQuery.order("received_at", { ascending: false, nullsFirst: false }).limit(200);

  const filters: { value: string; label: string }[] = [
    { value: "", label: "전체" },
    ...propertyList.map((p) => ({ value: p.id, label: p.name })),
    { value: UNMAPPED_FILTER, label: "숙소 미확정" },
  ];
  const propertyNames = Object.fromEntries(propertyList.map((p) => [p.id, p.name]));

  return (
    <div className="min-h-dvh bg-gray-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">{PRODUCT_NAME} 전체 수신함</h1>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <Link
              key={f.value || "all"}
              href={f.value ? `/host/airbnb?property=${encodeURIComponent(f.value)}` : "/host/airbnb"}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                selected === f.value ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <PropertyInbox key={selected || "all"} initialMails={(mails ?? []) as AirbnbInboundMail[]} propertyNames={propertyNames} />
      </main>
    </div>
  );
}

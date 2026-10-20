import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  if (user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) redirect("/");

  const [{ data: mails }, { data: properties }] = await Promise.all([
    supabase
      .from("airbnb_inbound_mails")
      .select("*")
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase.from("properties").select("id, name").eq("host_id", user.id),
  ]);

  return (
    <div className="min-h-dvh bg-gray-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">에어비앤비 수신함</h1>
          <p className="mt-1 text-sm text-gray-500">
            공동호스트 메일로 들어온 게스트 메시지와 답장 초안입니다. 초안을 복사해 에어비앤비에서 직접 보내세요.
          </p>
        </div>
        <AirbnbInbox
          initialMails={(mails ?? []) as AirbnbInboundMail[]}
          properties={(properties ?? []) as Pick<Property, "id" | "name">[]}
        />
      </main>
    </div>
  );
}

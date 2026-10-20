import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HomeHeader from "@/components/layout/HomeHeader";
import HostDashboardContent from "@/components/host/HostDashboardContent";
import type { Property } from "@/types/database";

export default async function HostPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("profiles").update({ role: "host" }).eq("id", user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();

  const { data: properties } = await supabase
    .from("properties")
    .select("*")
    .eq("host_id", user.id)
    .order("created_at", { ascending: false });

  // 숙소별 '답변 필요' 수: 게스트 메시지 중 아직 호스트가 보내지 않은 것(new / drafted). RLS 로 자기 숙소 메일만 읽힌다.
  const { data: pending } = await supabase
    .from("airbnb_inbound_mails")
    .select("property_id")
    .eq("kind", "message")
    .in("status", ["new", "drafted"])
    .not("property_id", "is", null);
  const pendingCounts: Record<string, number> = {};
  for (const row of (pending ?? []) as { property_id: string }[]) {
    pendingCounts[row.property_id] = (pendingCounts[row.property_id] ?? 0) + 1;
  }

  const isAdmin = !!process.env.NEXT_PUBLIC_ADMIN_EMAIL && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  return (
    <div className="min-h-dvh bg-gray-50">
      <HomeHeader
        userName={profile?.name ?? null}
        avatarUrl={user.user_metadata?.avatar_url ?? null}
        showHostLink
      />

      <HostDashboardContent properties={(properties ?? []) as Property[]} pendingCounts={pendingCounts} isAdmin={isAdmin} />
    </div>
  );
}

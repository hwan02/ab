import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import HomeHeader from "@/components/layout/HomeHeader";
import HostDashboardContent from "@/components/host/HostDashboardContent";
import { formatDate } from "@/lib/utils";
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

  return (
    <div className="min-h-dvh bg-gray-50">
      <HomeHeader
        userName={profile?.name ?? null}
        avatarUrl={user.user_metadata?.avatar_url ?? null}
      />

      <HostDashboardContent properties={(properties ?? []) as Property[]} />
    </div>
  );
}

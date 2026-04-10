import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HomeHeader from "@/components/layout/HomeHeader";
import HomeContent from "@/components/home/HomeContent";
import type { Property, Profile } from "@/types/database";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  const { data: allProperties } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });

  const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  return (
    <div className="min-h-dvh bg-gray-50">
      <HomeHeader
        userName={profile?.name ?? null}
        avatarUrl={user.user_metadata?.avatar_url ?? null}
        isAdmin={isAdmin}
      />

      <HomeContent
        isHost={isAdmin}
        properties={(allProperties as Property[]) ?? []}
      />
    </div>
  );
}

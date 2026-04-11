import { createClient } from "@/lib/supabase/server";
import HomeHeader from "@/components/layout/HomeHeader";
import HomeContent from "@/components/home/HomeContent";
import LandingPage from "@/components/home/LandingPage";
import type { Property, Profile } from "@/types/database";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in → show landing page
  if (!user) {
    return <LandingPage />;
  }

  const { data: allProperties } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

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

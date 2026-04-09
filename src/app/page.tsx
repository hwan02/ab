import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
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

  const { data: guestProperties } = await supabase
    .from("property_guests")
    .select("property_id, properties(*)")
    .eq("guest_id", user.id);

  const myProperties: Property[] =
    guestProperties
      ?.map((pg) => pg.properties as unknown as Property)
      .filter(Boolean) ?? [];

  const { data: allProperties } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });

  const browseProperties: Property[] = (allProperties ?? []).filter(
    (p) => !myProperties.some((mp) => mp.id === p.id)
  );

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
        myProperties={myProperties}
        browseProperties={browseProperties}
      />
    </div>
  );
}

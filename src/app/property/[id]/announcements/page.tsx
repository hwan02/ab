import { createClient } from "@/lib/supabase/server";
import AnnouncementsPageContent from "@/components/announcements/AnnouncementsPageContent";
import type { Announcement } from "@/types/database";

interface AnnouncementsPageProps {
  params: Promise<{ id: string }>;
}

export default async function AnnouncementsPage({
  params,
}: AnnouncementsPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .eq("property_id", id)
    .order("created_at", { ascending: false })
    .returns<Announcement[]>();

  return <AnnouncementsPageContent announcements={announcements} />;
}

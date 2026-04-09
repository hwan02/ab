import { createClient } from "@/lib/supabase/server";
import EmergencyPageContent from "@/components/emergency/EmergencyPageContent";
import type { EmergencyContact } from "@/types/database";

interface EmergencyPageProps {
  params: Promise<{ id: string }>;
}

export default async function EmergencyPage({ params }: EmergencyPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contacts } = await supabase
    .from("emergency_contacts")
    .select("*")
    .eq("property_id", id)
    .order("name", { ascending: true })
    .returns<EmergencyContact[]>();

  return <EmergencyPageContent contacts={contacts} />;
}

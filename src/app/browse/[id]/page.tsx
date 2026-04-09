import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BrowsePropertyContent from "@/components/browse/BrowsePropertyContent";
import type { Property, GuestRequest } from "@/types/database";

export default async function BrowsePropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id, name, address, description, photos")
    .eq("id", id)
    .single<Pick<Property, "id" | "name" | "address" | "description" | "photos">>();

  if (!property) {
    redirect("/");
  }

  const { data: existingRequest } = await supabase
    .from("guest_requests")
    .select("id, status")
    .eq("property_id", id)
    .eq("guest_id", user.id)
    .eq("status", "pending")
    .maybeSingle<Pick<GuestRequest, "id" | "status">>();

  return (
    <div className="min-h-dvh bg-gray-50">
      <BrowsePropertyContent
        property={property}
        hasPendingRequest={!!existingRequest}
      />
    </div>
  );
}

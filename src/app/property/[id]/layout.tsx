import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PropertyLayoutShell from "@/components/layout/PropertyLayoutShell";
import type { Property } from "@/types/database";

interface PropertyLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("name")
    .eq("id", id)
    .single<Pick<Property, "name">>();

  return {
    title: property?.name ?? "숙소 정보",
  };
}

export default async function PropertyLayout({
  children,
  params,
}: PropertyLayoutProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id, name, name_en, name_ja, name_zh, description, address, photos")
    .eq("id", id)
    .single<Pick<Property, "id" | "name" | "name_en" | "name_ja" | "name_zh" | "description" | "address" | "photos">>();

  if (!property) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in → show property but no stay period (chat/concierge will require login)
  if (!user) {
    return (
      <PropertyLayoutShell
        propertyId={property.id}
        propertyName={property.name}
        propertyNameEn={property.name_en}
        propertyNameJa={property.name_ja}
        propertyNameZh={property.name_zh}
        checkIn={null}
        checkOut={null}
        isWithinStayPeriod={false}
        isLoggedIn={false}
      >
        {children}
      </PropertyLayoutShell>
    );
  }

  const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  const { data: guestRecord } = await supabase
    .from("property_guests")
    .select("id, check_in, check_out")
    .eq("property_id", id)
    .eq("guest_id", user.id)
    .maybeSingle();

  const today = new Date().toISOString().split("T")[0];
  const isWithinStayPeriod = isAdmin || (guestRecord
    ? (!guestRecord.check_in && !guestRecord.check_out) ||
      ((!guestRecord.check_in || guestRecord.check_in <= today) &&
       (!guestRecord.check_out || guestRecord.check_out >= today))
    : false);

  return (
    <PropertyLayoutShell
      propertyId={property.id}
      propertyName={property.name}
      propertyNameEn={property.name_en}
      propertyNameJa={property.name_ja}
      propertyNameZh={property.name_zh}
      checkIn={guestRecord?.check_in ?? null}
      checkOut={guestRecord?.check_out ?? null}
      isWithinStayPeriod={isWithinStayPeriod}
      isLoggedIn={true}
    >
      {children}
    </PropertyLayoutShell>
  );
}

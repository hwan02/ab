import { notFound, redirect } from "next/navigation";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id, name, description, address, photos")
    .eq("id", id)
    .single<Pick<Property, "id" | "name" | "description" | "address" | "photos">>();

  if (!property) {
    notFound();
  }

  const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  // Check guest record for stay dates (used for chat/concierge gating)
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

  // Everyone can see the property - chat/concierge gated by stay period
  return (
    <PropertyLayoutShell
      propertyId={property.id}
      propertyName={property.name}
      checkIn={guestRecord?.check_in ?? null}
      checkOut={guestRecord?.check_out ?? null}
      isWithinStayPeriod={isWithinStayPeriod}
    >
      {children}
    </PropertyLayoutShell>
  );
}

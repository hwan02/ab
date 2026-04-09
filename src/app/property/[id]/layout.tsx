import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PropertyLayoutShell from "@/components/layout/PropertyLayoutShell";
import RestrictedPropertyView from "@/components/property/RestrictedPropertyView";
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

  // Check if user is admin (host)
  const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  // Check if user is an approved guest with valid dates
  const { data: guestRecord } = await supabase
    .from("property_guests")
    .select("id, check_in, check_out")
    .eq("property_id", id)
    .eq("guest_id", user.id)
    .maybeSingle();

  const today = new Date().toISOString().split("T")[0];
  const isWithinStayPeriod = guestRecord
    ? (!guestRecord.check_in && !guestRecord.check_out) || // null dates = unlimited
      ((!guestRecord.check_in || guestRecord.check_in <= today) &&
       (!guestRecord.check_out || guestRecord.check_out >= today))
    : false;

  const isApproved = isAdmin || (!!guestRecord && isWithinStayPeriod);
  const isExpired = !!guestRecord && !isWithinStayPeriod;

  // If not approved, show restricted view instead of children
  if (!isApproved) {
    // Check if there's a pending request
    const { data: pendingRequest } = await supabase
      .from("guest_requests")
      .select("id, status")
      .eq("property_id", id)
      .eq("guest_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return (
      <RestrictedPropertyView
        property={property}
        hasPendingRequest={pendingRequest?.status === "pending"}
        isExpired={isExpired}
      />
    );
  }

  return (
    <PropertyLayoutShell propertyId={property.id} propertyName={property.name}>
      {children}
    </PropertyLayoutShell>
  );
}

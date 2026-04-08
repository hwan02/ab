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
    .select("id, name")
    .eq("id", id)
    .single<Pick<Property, "id" | "name">>();

  if (!property) {
    notFound();
  }

  return (
    <PropertyLayoutShell propertyId={property.id} propertyName={property.name}>
      {children}
    </PropertyLayoutShell>
  );
}

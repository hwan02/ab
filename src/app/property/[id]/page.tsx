import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PhotoGallery from "@/components/property/PhotoGallery";
import PropertyInfo from "@/components/property/PropertyInfo";
import LocalizedPropertyDetails from "@/components/property/LocalizedPropertyDetails";
import WeatherWidget from "@/components/property/WeatherWidget";
import { T } from "@/components/i18n/T";
import type { Property } from "@/types/database";

interface PropertyPageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .single<Property>();

  if (!property) {
    notFound();
  }

  return (
    <div className="px-4 py-4">
      {/* Photo Gallery */}
      <PhotoGallery photos={property.photos ?? []} />

      {/* Property Name, Address & Description (localized) */}
      <LocalizedPropertyDetails property={property} />

      {/* Weather */}
      <div className="mt-4">
        <WeatherWidget latitude={property.latitude} longitude={property.longitude} />
      </div>

      {/* Info Sections */}
      <div className="mt-6">
        <h3 className="mb-3 text-base font-bold text-gray-900">
          <T k="property.guide" />
        </h3>
        <PropertyInfo property={property} />
      </div>
    </div>
  );
}

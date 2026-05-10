import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PhotoGallery from "@/components/property/PhotoGallery";
import PropertyInfo from "@/components/property/PropertyInfo";
import LocalizedPropertyDetails from "@/components/property/LocalizedPropertyDetails";
import WeatherWidget from "@/components/property/WeatherWidget";
import PropertyGuideSection from "@/components/property/PropertyGuideSection";
import { T } from "@/components/i18n/T";
import type { Property, PodongPhoto, PropertyGuide } from "@/types/database";

interface PropertyPageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [propertyResult, podongResult, guidesResult] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).single<Property>(),
    supabase
      .from("podong_photos")
      .select("id")
      .eq("property_id", id)
      .limit(1),
    supabase
      .from("property_guides")
      .select("*")
      .eq("property_id", id)
      .order("category", { ascending: true })
      .order("display_order", { ascending: true })
      .returns<PropertyGuide[]>(),
  ]);

  const property = propertyResult.data;
  if (!property) {
    notFound();
  }

  const hasPodongPhotos = (podongResult.data?.length ?? 0) > 0;
  const guides = guidesResult.data ?? [];

  return (
    <div className="max-w-full overflow-hidden px-4 py-4">
      {/* Photo Gallery */}
      <PhotoGallery photos={property.photos ?? []} />

      {/* Property Name, Address & Description (localized) */}
      <LocalizedPropertyDetails property={property} />

      {/* Podong Gallery Button */}
      {hasPodongPhotos && (
        <Link
          href={`/property/${id}/podong`}
          className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900">
              <T k="podong.viewGallery" />
            </p>
            <p className="text-xs text-amber-700">
              <T k="podong.subtitle" />
            </p>
          </div>
          <svg className="h-5 w-5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      )}

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

      {/* Detailed Guides */}
      {guides.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-base font-bold text-gray-900">
            <T k="guide.title" />
          </h3>
          <PropertyGuideSection guides={guides} />
        </div>
      )}
    </div>
  );
}

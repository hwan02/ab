import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PhotoGallery from "@/components/property/PhotoGallery";
import PropertyInfo from "@/components/property/PropertyInfo";
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

      {/* Property Name & Address */}
      <div className="mt-4">
        <h2 className="text-xl font-bold text-gray-900">{property.name}</h2>
        {property.address && (
          <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 flex-shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            {property.address}
          </p>
        )}
      </div>

      {/* Description */}
      {property.description && (
        <div className="mt-4 rounded-xl bg-white p-4 border border-gray-200">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
            {property.description}
          </p>
        </div>
      )}

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

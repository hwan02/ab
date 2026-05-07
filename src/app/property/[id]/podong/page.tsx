import { createClient } from "@/lib/supabase/server";
import PodongGallery from "@/components/podong/PodongGallery";
import type { PodongPhoto } from "@/types/database";
import { T } from "@/components/i18n/T";

interface PodongPageProps {
  params: Promise<{ id: string }>;
}

export default async function PodongPage({ params }: PodongPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: photos } = await supabase
    .from("podong_photos")
    .select("*")
    .eq("property_id", id)
    .order("display_order", { ascending: true })
    .returns<PodongPhoto[]>();

  return (
    <div className="px-4 py-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          <T k="podong.title" />
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          <T k="podong.subtitle" />
        </p>
      </div>
      <PodongGallery photos={photos ?? []} />
    </div>
  );
}

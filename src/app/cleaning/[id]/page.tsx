import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { youtubeEmbedUrl } from "@/lib/youtube";
import PhotoGallery from "@/components/cleaning/PhotoGallery";
import type { CleaningGuide, Property } from "@/types/database";

export const metadata = {
  title: "청소 가이드",
  robots: { index: false, follow: false },
};

interface CleaningPageProps {
  params: Promise<{ id: string }>;
}

export default async function CleaningPage({ params }: CleaningPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [propertyResult, guidesResult] = await Promise.all([
    supabase
      .from("properties")
      .select("name")
      .eq("id", id)
      .single<Pick<Property, "name">>(),
    supabase
      .from("cleaning_guides")
      .select("*")
      .eq("property_id", id)
      .order("display_order", { ascending: true })
      .returns<CleaningGuide[]>(),
  ]);

  if (!propertyResult.data) {
    notFound();
  }

  const all = guidesResult.data ?? [];
  const steps = all.filter((g) => g.kind === "step");
  const locations = all.filter((g) => g.kind === "location");
  const supplies = all.filter((g) => g.kind === "supply");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900">청소 가이드</h1>
          <p className="mt-1 text-sm text-gray-500">{propertyResult.data.name}</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-4 py-6">
        {all.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            등록된 청소 가이드가 없습니다
          </div>
        )}

        {/* 청소 순서 */}
        {steps.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">청소 순서</h2>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-600">
                {steps.length}단계
              </span>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-gray-600">
              아래 순서대로 청소를 진행해 주세요. 감사합니다.
            </p>
            <ol className="space-y-5">
              {steps.map((guide, idx) => {
                const embedUrl = guide.youtube_url
                  ? youtubeEmbedUrl(guide.youtube_url)
                  : null;
                return (
                  <li
                    key={guide.id}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-sm font-bold text-white">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {guide.title}
                        </h3>
                        {guide.description && (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                            {guide.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {guide.photo_urls.length > 0 && (
                      <div className="mt-4">
                        <PhotoGallery urls={guide.photo_urls} alt={guide.title} />
                      </div>
                    )}

                    {embedUrl && (
                      <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg">
                        <iframe
                          src={embedUrl}
                          title={`${guide.title} 영상`}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}

                    {!embedUrl && guide.youtube_url && (
                      <a
                        href={guide.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                        유튜브 영상 보기
                      </a>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* 보관 위치 */}
        {locations.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">보관 위치</h2>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {locations.length}곳
              </span>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-gray-600">
              청소용품은 아래 위치에서 찾으실 수 있습니다.
            </p>
            <ul className="space-y-4">
              {locations.map((loc) => (
                <li
                  key={loc.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <svg
                      className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.8}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                    <h3 className="text-base font-semibold text-gray-900">{loc.title}</h3>
                  </div>
                  {loc.description && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                      {loc.description}
                    </p>
                  )}
                  {loc.photo_urls.length > 0 && (
                    <div className="mt-3">
                      <PhotoGallery urls={loc.photo_urls} alt={loc.title} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 청소용품 */}
        {supplies.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">청소용품</h2>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {supplies.length}개
              </span>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-gray-600">
              아래 용품들을 사용해 주세요.
            </p>
            <ul className="space-y-4">
              {supplies.map((supply) => (
                <li
                  key={supply.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="text-base font-semibold text-gray-900">{supply.title}</h3>
                  {supply.description && (
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                      {supply.description}
                    </p>
                  )}
                  {supply.photo_urls.length > 0 && (
                    <div className="mt-3">
                      <PhotoGallery urls={supply.photo_urls} alt={supply.title} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

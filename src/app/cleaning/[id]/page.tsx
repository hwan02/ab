import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { youtubeEmbedUrl } from "@/lib/youtube";
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

  const guides = guidesResult.data ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900">청소 가이드</h1>
          <p className="mt-1 text-sm text-gray-500">{propertyResult.data.name}</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {guides.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            등록된 청소 가이드가 없습니다
          </div>
        ) : (
          <>
            <p className="mb-5 text-sm leading-relaxed text-gray-600">
              아래 순서대로 청소를 진행해 주세요. 감사합니다.
            </p>
            <ol className="space-y-5">
              {guides.map((guide, idx) => {
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
                        <h2 className="text-lg font-semibold text-gray-900">
                          {guide.title}
                        </h2>
                        {guide.description && (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                            {guide.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {guide.photo_urls.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {guide.photo_urls.map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-lg"
                          >
                            <img
                              src={url}
                              alt=""
                              className="h-40 w-full object-cover transition-transform hover:scale-105"
                            />
                          </a>
                        ))}
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
          </>
        )}
      </main>
    </div>
  );
}

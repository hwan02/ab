import { createClient } from "@/lib/supabase/server";
import Header from "@/components/layout/Header";
import ReviewsContent from "@/components/reviews/ReviewsContent";
import type { Review } from "@/types/database";

export default async function ReviewsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: reviews } = await supabase
    .from("reviews")
    .select("*, profiles(name, avatar_url)")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-dvh bg-gray-50">
      <Header />
      <ReviewsContent reviews={(reviews as Review[]) ?? []} currentUserId={user?.id ?? null} />
    </div>
  );
}

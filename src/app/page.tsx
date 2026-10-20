import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import HomeHeader from "@/components/layout/HomeHeader";
import HomeContent from "@/components/home/HomeContent";
import LandingPage from "@/components/home/LandingPage";
import type { PropertyPublic, Profile } from "@/types/database";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in and hasn't entered yet → show landing page
  const cookieStore = await cookies();
  const hasEntered = cookieStore.get("entered");
  if (!user && !hasEntered) {
    return <LandingPage />;
  }

  // 공개 뷰(properties_public): 와이파이·주소가 없는 컬럼만. properties 테이블은 RLS 로
  // 호스트·등록 게스트에게만 보이므로 목록은 뷰에서 읽는다(클라이언트 컴포넌트로 넘어가는 행에도 비밀번호가 없다).
  const { data: allProperties } = await supabase
    .from("properties_public")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<PropertyPublic[]>();

  if (!user) {
    return (
      <div className="min-h-dvh bg-gray-50">
        <HomeHeader userName={null} avatarUrl={null} showHostLink={false} />
        <HomeContent isHost={false} properties={allProperties ?? []} />
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  // 로그인한 사용자는 누구나 호스트 화면에 들어갈 수 있으므로 호스트 모드 링크/배너를 전원에게 보인다.
  return (
    <div className="min-h-dvh bg-gray-50">
      <HomeHeader
        userName={profile?.name ?? null}
        avatarUrl={user.user_metadata?.avatar_url ?? null}
        showHostLink
      />

      <HomeContent
        isHost
        properties={allProperties ?? []}
      />
    </div>
  );
}

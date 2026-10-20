import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BrowsePropertyContent from "@/components/browse/BrowsePropertyContent";
import type { PropertyPublic } from "@/types/database";
import type { GuestRequest } from "@/types/database";

export default async function BrowsePropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 공개 뷰: 아직 등록되지 않은 게스트가 보는 페이지라 RLS 가 걸린 properties 대신 뷰를 읽는다
  // (와이파이·주소 없음 → 클라이언트 컴포넌트로 넘어가지 않는다).
  const { data: property } = await supabase
    .from("properties_public")
    .select("*")
    .eq("id", id)
    .maybeSingle<PropertyPublic>();

  if (!property) {
    redirect("/");
  }

  const { data: existingRequest } = await supabase
    .from("guest_requests")
    .select("id, status")
    .eq("property_id", id)
    .eq("guest_id", user.id)
    .eq("status", "pending")
    .maybeSingle<Pick<GuestRequest, "id" | "status">>();

  return (
    <div className="min-h-dvh bg-gray-50">
      <BrowsePropertyContent
        property={property}
        hasPendingRequest={!!existingRequest}
      />
    </div>
  );
}

import { redirect } from "next/navigation";

/** 테스트는 자동응답 화면의 탭으로 옮겼다. */
export default async function TestRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/host/property/${id}/rules?tab=test`);
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * 포포톡 첫 화면: 호스트가 들어와서 자동응답을 설정하는 서비스이므로
 * 로그인했으면 내 숙소(/host)로, 아니면 로그인으로 보낸다.
 * 게스트용 숙소 안내 페이지(/property/[id])는 주소로만 접근한다.
 */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/host" : "/login?next=%2Fhost");
}

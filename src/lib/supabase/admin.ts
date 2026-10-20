import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * 서비스 롤 클라이언트. 쿠키/세션 없이 서버 전용(크론, 웹훅)에서만 쓴다.
 * 절대 클라이언트 컴포넌트에서 import 하지 말 것.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

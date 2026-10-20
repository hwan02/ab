import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** 로그인 후 기본 진입점. 로그인한 사용자는 누구나 호스트 화면으로 간다. */
const DEFAULT_AFTER_LOGIN = "/host";

/**
 * `next` 파라미터는 같은 사이트 안의 경로만 허용한다("/..." 로 시작하고 "//", "/\" 는 제외).
 * 게스트 전용 플로우처럼 로그인 뒤 돌아갈 곳이 있을 때만 쓰고, 없으면 /host 로 보낸다.
 */
function resolveNext(next: string | null): string {
  if (!next) return DEFAULT_AFTER_LOGIN;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN;
  }
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = resolveNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login`);
}

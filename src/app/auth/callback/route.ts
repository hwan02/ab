import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** 로그인 후 기본 진입점(게스트 홈). 호스트 화면은 `next=/host…` 로만 들어간다(middleware 가 붙여 준다). */
const DEFAULT_AFTER_LOGIN = "/";

/**
 * `next` 파라미터는 같은 사이트 안의 경로만 허용한다("/..." 로 시작하고 "//", "/\" 는 제외).
 * 게스트 플로우(컨시어지·리뷰 등)와 호스트 진입 모두 로그인 페이지가 콜백 URL 에 넘겨 준다. 없으면 '/'.
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

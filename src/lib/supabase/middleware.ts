import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 로그인 여부만 확인하면 되므로 서버 왕복이 있는 getUser() 대신 JWT 를 로컬에서 검증하는 getClaims() 를 쓴다.
  // (페이지·API 는 여전히 getUser() 로 재검증한다.)
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ? { id: claimsData.claims.sub } : null;

  // /host 는 로그인만 필요. 숙소는 host_id 로, 수신함과 규칙은 RLS 로 각자 것만 보인다.
  // 로그인 뒤 원래 가려던 호스트 경로로 돌아오도록 ?next= 를 붙인다(로그인 페이지 → 콜백으로 전달).
  if (request.nextUrl.pathname.startsWith("/host") && !user) {
    const { pathname, search } = request.nextUrl;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

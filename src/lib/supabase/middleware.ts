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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (except for public routes)
  const publicPrefixes = ["/login", "/auth/login", "/auth/callback", "/property", "/faq", "/reviews", "/browse"];
  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    pathname === "/" ||
    publicPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Restrict /host routes to admin only
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  if (user && request.nextUrl.pathname.startsWith("/host") && user.email !== adminEmail) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

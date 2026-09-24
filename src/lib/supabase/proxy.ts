import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LOCAL_COOKIE, localAuthToken } from "@/lib/local-auth";

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

/** Protege /admin. Com Supabase valida a sessão; sem Supabase usa o cookie do modo local. */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  if (!isAdminRoute) return NextResponse.next({ request });
  const isLoginRoute = pathname === "/admin/login";

  if (!isSupabaseConfigured) {
    const authed = request.cookies.get(LOCAL_COOKIE)?.value === localAuthToken();
    if (!authed && !isLoginRoute) return redirectTo(request, "/admin/login");
    if (authed && isLoginRoute) return redirectTo(request, "/admin/dashboard");
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() revalida o token no servidor Supabase; getSession() só lê o cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isLoginRoute) return redirectTo(request, "/admin/login");
  if (user && isLoginRoute) return redirectTo(request, "/admin/dashboard");
  return response;
}

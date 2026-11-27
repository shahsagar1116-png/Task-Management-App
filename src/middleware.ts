import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages anyone can open without signing in.
const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth/confirm", "/auth/signout"];

// Spec Section 9: a session ends 12 hours after the user signed in.
const MAX_SESSION_SECONDS = 12 * 60 * 60;

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response; // the page will show the missing-setting error

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refreshes the session cookie if needed. Do not put code between this and createServerClient.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  const redirectTo = (pathname: string, params?: Record<string, string>) => {
    const target = request.nextUrl.clone();
    target.pathname = pathname;
    target.search = "";
    for (const [k, v] of Object.entries(params ?? {})) target.searchParams.set(k, v);
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!claims) {
    return isPublic ? response : redirectTo("/login");
  }

  // amr holds when the user actually signed in; it does not change on token refresh.
  const amr = (claims.amr ?? []) as { timestamp?: number }[];
  const signedInAt = Math.min(...amr.map((a) => a.timestamp ?? Infinity));
  if (Number.isFinite(signedInAt) && Date.now() / 1000 - signedInAt > MAX_SESSION_SECONDS) {
    await supabase.auth.signOut();
    return redirectTo("/login", { expired: "1" });
  }

  if (path === "/login") return redirectTo("/dashboard");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

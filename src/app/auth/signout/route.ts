import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const target = request.nextUrl.clone();
  target.pathname = "/login";
  target.search = "";
  target.searchParams.set(
    request.nextUrl.searchParams.get("reason") === "inactive" ? "inactive" : "signedout",
    "1",
  );
  return NextResponse.redirect(target, { status: 303 });
}

export const GET = signOut;
export const POST = signOut;

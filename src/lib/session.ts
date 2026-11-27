import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, Role } from "@/lib/roles";

export type Session = {
  user: AppUser;
  firmName: string;
};

// The signed-in user's row from public.users, or null if not signed in or not
// set up / deactivated in the app.
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: user } = await supabase
    .from("users")
    .select("id, firm_id, name, email, mobile, role, active, created_at")
    .eq("id", auth.user.id)
    .eq("is_deleted", false)
    .maybeSingle<AppUser>();
  if (!user || !user.active) return null;

  const { data: firm } = await supabase
    .from("firms")
    .select("name")
    .eq("id", user.firm_id)
    .maybeSingle<{ name: string }>();

  return { user, firmName: firm?.name ?? "" };
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/auth/signout?reason=inactive");
  return session;
}

/** True when the signed-in user has one of the given roles. */
export function hasRole(session: Session, roles: Role[]): boolean {
  return roles.includes(session.user.role);
}

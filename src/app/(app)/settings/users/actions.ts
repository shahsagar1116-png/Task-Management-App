"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { isRole } from "@/lib/roles";

export type ActionState = { error?: string; message?: string };

const NOT_PARTNER: ActionState = { error: "Only a partner can manage users." };
// Long enough to mean "until reactivated".
const BAN_FOREVER = "876000h";

async function partnerSession() {
  const session = await getSession();
  return session?.user.role === "partner" ? session : null;
}

export async function addUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await partnerSession();
  if (!session) return NOT_PARTNER;

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const mobile = String(formData.get("mobile") ?? "").trim() || null;
  const role = formData.get("role");
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Enter a name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };
  if (mobile && !/^\+?\d{10,13}$/.test(mobile.replace(/[\s-]/g, "")))
    return { error: "Mobile should be 10 digits, optionally with +91." };
  if (!isRole(role)) return { error: "Choose a role." };
  if (password.length < 8) return { error: "Temporary password must be at least 8 characters." };

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (authError || !created.user) {
    return {
      error: authError?.message.includes("already")
        ? "A login with this email already exists."
        : `Could not create the login: ${authError?.message ?? "unknown error"}`,
    };
  }

  // Insert as the partner, so Row Level Security checks the role again.
  const supabase = await createClient();
  const { error: rowError } = await supabase.from("users").insert({
    id: created.user.id,
    firm_id: session.user.firm_id,
    name,
    email,
    mobile,
    role,
  });
  if (rowError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: `Could not save the user: ${rowError.message}` };
  }

  revalidatePath("/settings/users");
  return {
    message: `${name} added. Share the temporary password with them in person; they can change it with "Forgot password".`,
  };
}

export async function changeRole(formData: FormData): Promise<void> {
  const session = await partnerSession();
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  const role = formData.get("role");
  if (!isRole(role) || id === session.user.id) return; // partners cannot demote themselves

  const supabase = await createClient();
  await supabase.from("users").update({ role }).eq("id", id);
  revalidatePath("/settings/users");
}

export async function setActive(formData: FormData): Promise<void> {
  const session = await partnerSession();
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (id === session.user.id) return; // partners cannot lock themselves out

  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ active }).eq("id", id);
  if (error) return;

  // Also block or unblock the login itself, which ends any open session at its next refresh.
  await createAdminClient().auth.admin.updateUserById(id, {
    ban_duration: active ? "none" : BAN_FOREVER,
  });
  revalidatePath("/settings/users");
}

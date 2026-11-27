"use server";

import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/origin";
import type { FormState } from "../login/actions";

export async function requestReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email." };

  const supabase = await createClient();
  const origin = await siteOrigin();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });
  // Same message whether or not the email exists, so logins cannot be guessed.
  return {
    message:
      "If that email has a login, a reset link is on its way. Open it on this same computer and browser.",
  };
}

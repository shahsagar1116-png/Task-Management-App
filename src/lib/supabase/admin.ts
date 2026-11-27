import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

// Server-only client with the secret key. It bypasses Row Level Security, so
// use it only after checking that the signed-in user is a partner.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'Missing environment variable SUPABASE_SECRET_KEY. See README.md, "Set up" step 4.',
    );
  }
  return createClient(supabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

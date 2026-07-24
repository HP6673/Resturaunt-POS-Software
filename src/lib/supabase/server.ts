import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-only client. Uses the service role key, which bypasses RLS entirely.
// Never import this file from a "use client" component or leak the key to the browser.
export function supabaseAdmin() {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

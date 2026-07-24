import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client, safe to use client-side. Only used for read-only queries and
// realtime subscriptions — RLS policies restrict anon to SELECT on operational
// tables (see supabase/schema.sql). All writes go through /api routes instead.
export const supabaseBrowser = createClient(url, anonKey);

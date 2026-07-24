import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireRole } from "@/lib/requireRole";

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "server"]);
  if ("error" in auth) return auth.error;

  const { tableId, guestCount } = await request.json();
  if (!tableId) {
    return NextResponse.json({ error: "tableId is required" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: existing, error: existingError } = await admin
    .from("tabs")
    .select("id")
    .eq("table_id", tableId)
    .neq("status", "closed")
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ id: existing.id });
  }

  const { data, error } = await admin
    .from("tabs")
    .insert({
      table_id: tableId,
      guest_count: guestCount ?? 1,
      server_id: auth.session.staffId,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

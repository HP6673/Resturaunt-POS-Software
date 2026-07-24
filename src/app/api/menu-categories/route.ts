import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireRole } from "@/lib/requireRole";

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;

  const { name, sortOrder } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("menu_categories")
    .insert({ name, sort_order: sortOrder ?? 0 })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

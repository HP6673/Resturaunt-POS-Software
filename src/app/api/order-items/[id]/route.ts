import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireRole } from "@/lib/requireRole";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(["admin", "server", "kitchen"]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const { status } = await request.json();

  if (!["pending", "ready", "served", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin.from("order_items").update({ status }).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

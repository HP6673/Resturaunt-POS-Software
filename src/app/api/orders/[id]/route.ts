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

  const { data: order, error: orderError } = await admin
    .from("orders")
    .update({ status })
    .eq("id", id)
    .select("tab_id")
    .single();
  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  // Bumping a whole ticket also bumps every item on it (except ones already cancelled).
  const { error: itemsError } = await admin
    .from("order_items")
    .update({ status })
    .eq("order_id", id)
    .neq("status", "cancelled");

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // Food hitting the table moves the tab into EATING.
  if (status === "served" && order) {
    await admin
      .from("tabs")
      .update({ status: "eating", status_changed_at: new Date().toISOString() })
      .eq("id", order.tab_id)
      .in("status", ["seated", "ordered"]);
  }

  return NextResponse.json({ ok: true });
}

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
  const body = await request.json();
  const update: Record<string, unknown> = {};

  if (typeof body.status === "string") {
    if (!["pending", "ready", "served", "cancelled"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (body.status === "cancelled" && auth.session.role !== "admin") {
      return NextResponse.json({ error: "Only admins can remove items" }, { status: 403 });
    }
    update.status = body.status;
  }

  if (body.price !== undefined) {
    if (auth.session.role !== "admin") {
      return NextResponse.json({ error: "Only admins can change prices" }, { status: 403 });
    }
    if (typeof body.price !== "number" || Number.isNaN(body.price) || body.price < 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }
    update.price_snapshot = body.price;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin.from("order_items").update(update).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

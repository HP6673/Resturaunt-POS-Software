import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireRole } from "@/lib/requireRole";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") update.name = body.name;
  if (typeof body.description === "string" || body.description === null) update.description = body.description;
  if (typeof body.price === "number") update.price = body.price;
  if (typeof body.isAvailable === "boolean") update.is_available = body.isAvailable;
  if (typeof body.categoryId === "string" || body.categoryId === null) update.category_id = body.categoryId;
  if (typeof body.sortOrder === "number") update.sort_order = body.sortOrder;

  const admin = supabaseAdmin();
  const { error } = await admin.from("menu_items").update(update).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const admin = supabaseAdmin();
  const { error } = await admin.from("menu_items").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

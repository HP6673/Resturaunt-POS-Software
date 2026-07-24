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
  if (typeof body.label === "string") update.label = body.label;
  if (typeof body.seats === "number") update.seats = body.seats;
  if (typeof body.posX === "number") update.pos_x = body.posX;
  if (typeof body.posY === "number") update.pos_y = body.posY;

  const admin = supabaseAdmin();
  const { error } = await admin.from("restaurant_tables").update(update).eq("id", id);

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
  const { error } = await admin.from("restaurant_tables").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

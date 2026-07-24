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
  if (typeof body.width === "number") update.width = body.width;
  if (typeof body.height === "number") update.height = body.height;
  if (typeof body.floorId === "string") update.floor_id = body.floorId;
  if (typeof body.shape === "string") {
    if (!["square", "round", "rectangle"].includes(body.shape)) {
      return NextResponse.json({ error: "Invalid shape" }, { status: 400 });
    }
    update.shape = body.shape;
  }

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

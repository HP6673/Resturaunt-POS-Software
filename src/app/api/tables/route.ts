import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireRole } from "@/lib/requireRole";

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;

  const { floorId, label, seats, posX, posY, shape, width, height } = await request.json();
  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  if (!floorId) {
    return NextResponse.json({ error: "floorId is required" }, { status: 400 });
  }
  if (shape && !["square", "round", "rectangle"].includes(shape)) {
    return NextResponse.json({ error: "Invalid shape" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("restaurant_tables")
    .insert({
      floor_id: floorId,
      label,
      seats: seats ?? 4,
      pos_x: posX ?? 10,
      pos_y: posY ?? 10,
      shape: shape ?? "square",
      width: width ?? 96,
      height: height ?? 96,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

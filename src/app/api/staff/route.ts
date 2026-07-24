import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireRole } from "@/lib/requireRole";

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;

  const { name, role, pin } = await request.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!["admin", "server", "kitchen"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (!pin || typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be 4-6 digits" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: staffList } = await admin.from("staff").select("pin_hash").eq("active", true);
  const collides = (staffList ?? []).some((s) => bcrypt.compareSync(pin, s.pin_hash));
  if (collides) {
    return NextResponse.json({ error: "That PIN is already in use — pick a different one" }, { status: 409 });
  }

  const pinHash = bcrypt.hashSync(pin, 10);

  const { data, error } = await admin
    .from("staff")
    .insert({ name: name.trim(), role, pin_hash: pinHash })
    .select("id, name, role, active")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

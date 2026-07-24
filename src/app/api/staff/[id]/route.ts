import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireRole } from "@/lib/requireRole";
import { decryptPin, encryptPin } from "@/lib/pinCrypto";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json();

  const admin = supabaseAdmin();
  const update: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.active === "boolean") update.active = body.active;
  if (typeof body.role === "string") {
    if (!["admin", "server", "kitchen"].includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    update.role = body.role;
  }

  if (typeof body.pin === "string") {
    if (!/^\d{6}$/.test(body.pin)) {
      return NextResponse.json({ error: "PIN must be exactly 6 digits" }, { status: 400 });
    }
    const { data: staffList } = await admin.from("staff").select("id, pin_encrypted").eq("active", true);
    const collides = (staffList ?? []).some((s) => {
      if (s.id === id) return false;
      try {
        return decryptPin(s.pin_encrypted) === body.pin;
      } catch {
        return false;
      }
    });
    if (collides) {
      return NextResponse.json({ error: "That PIN is already in use — pick a different one" }, { status: 409 });
    }
    update.pin_encrypted = encryptPin(body.pin);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await admin.from("staff").update(update).eq("id", id);

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
  if (id === auth.session.staffId) {
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin.from("staff").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

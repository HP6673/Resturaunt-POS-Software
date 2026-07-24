import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSessionCookie } from "@/lib/session";
import { decryptPin } from "@/lib/pinCrypto";

export async function POST(request: NextRequest) {
  const { pin } = await request.json();

  if (!pin || typeof pin !== "string") {
    return NextResponse.json({ error: "PIN is required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: staffList, error } = await admin
    .from("staff")
    .select("id, name, role, pin_encrypted, active")
    .eq("active", true);

  if (error) {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }

  const match = (staffList ?? []).find((s) => {
    try {
      return decryptPin(s.pin_encrypted) === pin;
    } catch {
      return false;
    }
  });

  if (!match) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  await createSessionCookie({
    staffId: match.id,
    name: match.name,
    role: match.role,
  });

  return NextResponse.json({ name: match.name, role: match.role });
}

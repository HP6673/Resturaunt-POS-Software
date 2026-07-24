import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireRole } from "@/lib/requireRole";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(["admin", "server"]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const { paymentMethod } = await request.json();

  if (!["cash", "card", "other"].includes(paymentMethod)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("tabs")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      payment_method: paymentMethod,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireRole } from "@/lib/requireRole";

interface IncomingItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "server"]);
  if ("error" in auth) return auth.error;

  const { tabId, items } = (await request.json()) as {
    tabId: string;
    items: IncomingItem[];
  };

  if (!tabId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "tabId and items are required" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({ tab_id: tabId, created_by: auth.session.staffId })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? "Failed to create order" }, { status: 500 });
  }

  const rows = items.map((item) => ({
    order_id: order.id,
    menu_item_id: item.menuItemId,
    name_snapshot: item.name,
    price_snapshot: item.price,
    quantity: item.quantity,
    note: item.note || null,
  }));

  const { error: itemsError } = await admin.from("order_items").insert(rows);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({ id: order.id });
}

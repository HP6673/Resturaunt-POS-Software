import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { KitchenBoard } from "@/components/KitchenBoard";

export default async function KitchenPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const admin = supabaseAdmin();
  const { data: orders } = await admin
    .from("orders")
    .select("*, order_items(*), tabs(table_id, restaurant_tables(label))")
    .in("status", ["pending", "ready"])
    .order("created_at");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <AppHeader name={session.name} role={session.role} />
      <KitchenBoard initialOrders={orders ?? []} />
    </div>
  );
}

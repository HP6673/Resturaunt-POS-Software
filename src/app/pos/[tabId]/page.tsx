import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { POSView } from "@/components/POSView";

export default async function POSPage({
  params,
}: {
  params: Promise<{ tabId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { tabId } = await params;
  const admin = supabaseAdmin();

  const { data: tab } = await admin.from("tabs").select("*").eq("id", tabId).maybeSingle();
  if (!tab) notFound();

  const { data: table } = await admin
    .from("restaurant_tables")
    .select("*")
    .eq("id", tab.table_id)
    .maybeSingle();

  const [{ data: categories }, { data: items }, { data: orders }] = await Promise.all([
    admin.from("menu_categories").select("*").order("sort_order"),
    admin.from("menu_items").select("*").order("sort_order"),
    admin
      .from("orders")
      .select("*, order_items(*)")
      .eq("tab_id", tabId)
      .order("created_at"),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <AppHeader name={session.name} role={session.role} />
      <POSView
        tab={tab}
        table={table}
        categories={categories ?? []}
        menuItems={items ?? []}
        initialOrders={orders ?? []}
      />
    </div>
  );
}

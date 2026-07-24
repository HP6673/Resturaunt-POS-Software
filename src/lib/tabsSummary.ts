import { supabaseBrowser } from "@/lib/supabase/client";
import type { Tab } from "@/lib/types";

export interface OpenTabSummary extends Tab {
  total: number;
}

// Client-side (anon key) computation of each open tab's running total.
// Reads orders + order_items directly (both are anon-SELECT-able, see supabase/schema.sql)
// rather than the tab_totals view, since RLS on views needs extra care to get right.
export async function fetchOpenTabsSummary(): Promise<OpenTabSummary[]> {
  const { data: tabs, error: tabsError } = await supabaseBrowser
    .from("tabs")
    .select("*")
    .neq("status", "closed");

  if (tabsError || !tabs || tabs.length === 0) return [];

  const tabIds = tabs.map((t) => t.id);

  const { data: orders } = await supabaseBrowser
    .from("orders")
    .select("id, tab_id, status, order_items(price_snapshot, quantity, status)")
    .in("tab_id", tabIds)
    .neq("status", "cancelled");

  const totals = new Map<string, number>();
  for (const order of orders ?? []) {
    const items = (order as unknown as {
      order_items: { price_snapshot: number; quantity: number; status: string }[];
    }).order_items;
    const sum = (items ?? [])
      .filter((i) => i.status !== "cancelled")
      .reduce((acc, i) => acc + i.price_snapshot * i.quantity, 0);
    totals.set(order.tab_id, (totals.get(order.tab_id) ?? 0) + sum);
  }

  return tabs.map((t) => ({ ...t, total: (totals.get(t.id) ?? 0) + t.adjustment }));
}

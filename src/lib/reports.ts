import type { SupabaseClient } from "@supabase/supabase-js";

export interface RangeStats {
  label: string;
  revenue: number;
  tabCount: number;
  averageTab: number;
}

export interface TopItem {
  name: string;
  quantity: number;
  revenue: number;
}

const RANGES: { key: string; label: string; hours: number | null }[] = [
  { key: "24h", label: "Last 24 hours", hours: 24 },
  { key: "7d", label: "Last 7 days", hours: 24 * 7 },
  { key: "30d", label: "Last 30 days", hours: 24 * 30 },
  { key: "all", label: "All time", hours: null },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getRevenueStats(admin: SupabaseClient<any>): Promise<RangeStats[]> {
  const { data: rows } = await admin
    .from("tab_totals")
    .select("closed_at, total, status")
    .eq("status", "closed");

  const closedTabs = (rows ?? []).filter((r) => r.closed_at) as { closed_at: string; total: number }[];
  const now = Date.now();

  return RANGES.map((range) => {
    const cutoff = range.hours === null ? null : now - range.hours * 60 * 60 * 1000;
    const inRange = cutoff === null ? closedTabs : closedTabs.filter((t) => new Date(t.closed_at).getTime() >= cutoff);
    const revenue = inRange.reduce((sum, t) => sum + t.total, 0);
    const tabCount = inRange.length;
    return {
      label: range.label,
      revenue,
      tabCount,
      averageTab: tabCount === 0 ? 0 : revenue / tabCount,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getTopItems(admin: SupabaseClient<any>, sinceHours = 24 * 30): Promise<TopItem[]> {
  const cutoff = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

  const { data } = await admin
    .from("order_items")
    .select("name_snapshot, price_snapshot, quantity, status, created_at")
    .neq("status", "cancelled")
    .gte("created_at", cutoff);

  const totals = new Map<string, TopItem>();
  for (const item of data ?? []) {
    const existing = totals.get(item.name_snapshot) ?? { name: item.name_snapshot, quantity: 0, revenue: 0 };
    existing.quantity += item.quantity;
    existing.revenue += item.quantity * item.price_snapshot;
    totals.set(item.name_snapshot, existing);
  }

  return Array.from(totals.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
}

"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { OrderItem, OrderStatus } from "@/lib/types";

interface KitchenOrder {
  id: string;
  tab_id: string;
  status: OrderStatus;
  created_at: string;
  order_items: OrderItem[];
  tabs: { table_id: string; restaurant_tables: { label: string } | null } | null;
}

function elapsedMinutes(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function Ticket({
  order,
  actionLabel,
  onCheck,
}: {
  order: KitchenOrder;
  actionLabel: string;
  onCheck: () => void;
}) {
  const [minutes, setMinutes] = useState(elapsedMinutes(order.created_at));

  useEffect(() => {
    const id = setInterval(() => setMinutes(elapsedMinutes(order.created_at)), 30000);
    return () => clearInterval(id);
  }, [order.created_at]);

  const urgent = minutes >= 15 && order.status === "pending";
  const label = order.tabs?.restaurant_tables?.label ?? "?";

  return (
    <div
      className={`flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border p-3 shadow-sm transition-shadow hover:shadow-md ${
        urgent ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-lg font-semibold text-slate-900">Table {label}</span>
        <span className={`shrink-0 text-sm ${urgent ? "text-red-600" : "text-slate-400"}`}>{minutes}m</span>
      </div>
      <div className="flex-1 space-y-1">
        {order.order_items
          .filter((i) => i.status !== "cancelled")
          .map((item) => (
            <div key={item.id} className="text-sm">
              <span className="font-medium text-slate-900">{item.quantity}x {item.name_snapshot}</span>
              {item.note && <span className="block truncate pl-4 text-xs text-amber-600">note: {item.note}</span>}
            </div>
          ))}
      </div>
      <label className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-shadow hover:bg-slate-50 hover:shadow-md">
        <input
          type="checkbox"
          checked={false}
          onChange={onCheck}
          className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="truncate">{actionLabel}</span>
      </label>
    </div>
  );
}

export function KitchenBoard({ initialOrders }: { initialOrders: KitchenOrder[] }) {
  const [orders, setOrders] = useState<KitchenOrder[]>(initialOrders);

  useEffect(() => {
    async function refetch() {
      const { data } = await supabaseBrowser
        .from("orders")
        .select("*, order_items(*), tabs(table_id, restaurant_tables(label))")
        .in("status", ["pending", "ready"])
        .order("created_at");
      if (data) setOrders(data as unknown as KitchenOrder[]);
    }

    const channel = supabaseBrowser
      .channel("kitchen-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, refetch)
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  async function bump(orderId: string, status: OrderStatus) {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  const pending = orders.filter((o) => o.status === "pending");
  const completed = orders.filter((o) => o.status === "ready");

  return (
    <div className="flex flex-1 gap-6 overflow-x-auto p-6">
      <section className="flex-1">
        <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">Pending ({pending.length})</h2>
        <div className="flex flex-wrap gap-4">
          {pending.map((o) => (
            <Ticket key={o.id} order={o} actionLabel="Mark complete" onCheck={() => bump(o.id, "ready")} />
          ))}
          {pending.length === 0 && <p className="text-sm text-slate-400">No tickets in the queue.</p>}
        </div>
      </section>
      <section className="flex-1">
        <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">Completed ({completed.length})</h2>
        <div className="flex flex-wrap gap-4">
          {completed.map((o) => (
            <Ticket key={o.id} order={o} actionLabel="Clear ticket" onCheck={() => bump(o.id, "served")} />
          ))}
          {completed.length === 0 && <p className="text-sm text-slate-400">Nothing here.</p>}
        </div>
      </section>
    </div>
  );
}

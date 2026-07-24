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

function Ticket({ order, onBump }: { order: KitchenOrder; onBump: (status: OrderStatus) => void }) {
  const [minutes, setMinutes] = useState(elapsedMinutes(order.created_at));

  useEffect(() => {
    const id = setInterval(() => setMinutes(elapsedMinutes(order.created_at)), 30000);
    return () => clearInterval(id);
  }, [order.created_at]);

  const urgent = minutes >= 15 && order.status === "pending";
  const label = order.tabs?.restaurant_tables?.label ?? "?";

  return (
    <div
      className={`flex w-72 shrink-0 flex-col rounded-xl border p-3 ${
        urgent ? "border-red-600 bg-red-950/30" : "border-neutral-800 bg-neutral-900"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-lg font-semibold">Table {label}</span>
        <span className={`text-sm ${urgent ? "text-red-400" : "text-neutral-500"}`}>{minutes}m</span>
      </div>
      <div className="flex-1 space-y-1">
        {order.order_items
          .filter((i) => i.status !== "cancelled")
          .map((item) => (
            <div key={item.id} className="text-sm">
              <span className="font-medium">{item.quantity}x {item.name_snapshot}</span>
              {item.note && <span className="block pl-4 text-xs text-amber-400">note: {item.note}</span>}
            </div>
          ))}
      </div>
      <div className="mt-3 flex gap-2">
        {order.status === "pending" && (
          <button
            onClick={() => onBump("ready")}
            className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium"
          >
            Mark ready
          </button>
        )}
        {order.status === "ready" && (
          <button
            onClick={() => onBump("served")}
            className="flex-1 rounded-lg bg-neutral-700 py-2 text-sm font-medium"
          >
            Served / clear
          </button>
        )}
      </div>
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
  const ready = orders.filter((o) => o.status === "ready");

  return (
    <div className="flex flex-1 gap-6 overflow-x-auto p-6">
      <section className="flex-1">
        <h2 className="mb-3 text-sm font-medium uppercase text-neutral-500">Preparing ({pending.length})</h2>
        <div className="flex flex-wrap gap-4">
          {pending.map((o) => (
            <Ticket key={o.id} order={o} onBump={(s) => bump(o.id, s)} />
          ))}
          {pending.length === 0 && <p className="text-sm text-neutral-600">No tickets in the queue.</p>}
        </div>
      </section>
      <section className="flex-1">
        <h2 className="mb-3 text-sm font-medium uppercase text-neutral-500">Ready for pickup ({ready.length})</h2>
        <div className="flex flex-wrap gap-4">
          {ready.map((o) => (
            <Ticket key={o.id} order={o} onBump={(s) => bump(o.id, s)} />
          ))}
          {ready.length === 0 && <p className="text-sm text-neutral-600">Nothing waiting.</p>}
        </div>
      </section>
    </div>
  );
}

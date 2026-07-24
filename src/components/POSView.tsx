"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { MenuCategory, MenuItem, Order, OrderItem, RestaurantTable, Tab } from "@/lib/types";

type OrderWithItems = Order & { order_items: OrderItem[] };

interface CartLine {
  key: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  note: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Fired",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "text-amber-400",
  ready: "text-emerald-400",
  served: "text-neutral-500",
  cancelled: "text-neutral-600 line-through",
};

export function POSView({
  tab,
  table,
  categories,
  menuItems,
  initialOrders,
}: {
  tab: Tab;
  table: RestaurantTable | null;
  categories: MenuCategory[];
  menuItems: MenuItem[];
  initialOrders: OrderWithItems[];
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string | "all">(categories[0]?.id ?? "all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders);
  const [sending, setSending] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    async function refetchOrders() {
      const { data } = await supabaseBrowser
        .from("orders")
        .select("*, order_items(*)")
        .eq("tab_id", tab.id)
        .order("created_at");
      if (data) setOrders(data as unknown as OrderWithItems[]);
    }

    const channel = supabaseBrowser
      .channel(`pos-tab-${tab.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, refetchOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refetchOrders)
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [tab.id]);

  const visibleItems = useMemo(
    () =>
      menuItems.filter(
        (item) => item.is_available && (activeCategory === "all" || item.category_id === activeCategory),
      ),
    [menuItems, activeCategory],
  );

  const firedTotal = useMemo(
    () =>
      orders
        .filter((o) => o.status !== "cancelled")
        .flatMap((o) => o.order_items)
        .filter((i) => i.status !== "cancelled")
        .reduce((sum, i) => sum + i.price_snapshot * i.quantity, 0),
    [orders],
  );

  const cartTotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id && l.note === "");
      if (existing) {
        return prev.map((l) => (l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        { key: `${item.id}-${Date.now()}`, menuItemId: item.id, name: item.name, price: item.price, quantity: 1, note: "" },
      ];
    });
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  async function sendToKitchen() {
    if (cart.length === 0) return;
    setSending(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tabId: tab.id,
          items: cart.map((l) => ({
            menuItemId: l.menuItemId,
            name: l.name,
            price: l.price,
            quantity: l.quantity,
            note: l.note,
          })),
        }),
      });
      if (res.ok) setCart([]);
    } finally {
      setSending(false);
    }
  }

  async function closeTab(paymentMethod: "cash" | "card" | "other") {
    setClosing(true);
    try {
      const res = await fetch(`/api/tabs/${tab.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod }),
      });
      if (res.ok) router.push("/tables");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Menu browser */}
      <div className="flex flex-1 flex-col overflow-hidden border-r border-neutral-800">
        <div className="flex gap-1 overflow-x-auto border-b border-neutral-800 p-3">
          <button
            onClick={() => setActiveCategory("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${activeCategory === "all" ? "bg-white text-neutral-900" : "bg-neutral-800 text-neutral-300"}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${activeCategory === c.id ? "bg-white text-neutral-900" : "bg-neutral-800 text-neutral-300"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 lg:grid-cols-4">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              onClick={() => addToCart(item)}
              className="flex flex-col items-start gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-left hover:border-emerald-600 hover:bg-neutral-800"
            >
              <span className="font-medium">{item.name}</span>
              {item.description && <span className="text-xs text-neutral-500">{item.description}</span>}
              <span className="mt-1 text-sm text-emerald-400">${item.price.toFixed(2)}</span>
            </button>
          ))}
          {visibleItems.length === 0 && (
            <p className="col-span-full text-sm text-neutral-500">No items in this category.</p>
          )}
        </div>
      </div>

      {/* Ticket / cart */}
      <div className="flex w-96 shrink-0 flex-col overflow-hidden">
        <div className="border-b border-neutral-800 p-4">
          <h2 className="font-semibold">Table {table?.label ?? "?"}</h2>
          <p className="text-xs text-neutral-500">{tab.guest_count} guests · Tab {tab.status.replace("_", " ")}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {orders.length > 0 && (
            <div className="mb-4 space-y-3">
              <h3 className="text-xs font-medium uppercase text-neutral-500">Sent to kitchen</h3>
              {orders
                .filter((o) => o.status !== "cancelled")
                .map((order) => (
                  <div key={order.id} className="rounded-lg border border-neutral-800 p-2 text-sm">
                    {order.order_items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-0.5">
                        <span>
                          {item.quantity}x {item.name_snapshot}
                          {item.note && <span className="text-neutral-500"> ({item.note})</span>}
                        </span>
                        <span className={STATUS_COLOR[item.status]}>{STATUS_LABEL[item.status]}</span>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          )}

          <h3 className="text-xs font-medium uppercase text-neutral-500">New items</h3>
          {cart.length === 0 && <p className="mt-2 text-sm text-neutral-600">Tap menu items to add them.</p>}
          <div className="mt-2 space-y-2">
            {cart.map((line) => (
              <div key={line.key} className="rounded-lg border border-neutral-800 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{line.name}</span>
                  <span className="text-sm">${(line.price * line.quantity).toFixed(2)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    onClick={() => updateLine(line.key, { quantity: Math.max(1, line.quantity - 1) })}
                    className="h-6 w-6 rounded bg-neutral-800 text-sm"
                  >
                    -
                  </button>
                  <span className="w-4 text-center text-sm">{line.quantity}</span>
                  <button
                    onClick={() => updateLine(line.key, { quantity: line.quantity + 1 })}
                    className="h-6 w-6 rounded bg-neutral-800 text-sm"
                  >
                    +
                  </button>
                  <input
                    value={line.note}
                    onChange={(e) => updateLine(line.key, { note: e.target.value })}
                    placeholder="note e.g. no onions"
                    className="ml-1 flex-1 rounded bg-neutral-900 px-2 py-1 text-xs outline-none ring-1 ring-neutral-800 focus:ring-emerald-600"
                  />
                  <button onClick={() => removeLine(line.key)} className="text-xs text-red-400">
                    remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-neutral-800 p-4">
          <div className="mb-3 flex justify-between text-sm">
            <span className="text-neutral-400">Fired</span>
            <span>${firedTotal.toFixed(2)}</span>
          </div>
          {cart.length > 0 && (
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-neutral-400">New</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="mb-4 flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>${(firedTotal + cartTotal).toFixed(2)}</span>
          </div>

          <button
            disabled={cart.length === 0 || sending}
            onClick={sendToKitchen}
            className="mb-2 w-full rounded-lg bg-emerald-600 py-2.5 font-medium disabled:opacity-40"
          >
            {sending ? "Sending..." : "Send to kitchen"}
          </button>
          <button
            onClick={() => setShowCheckout(true)}
            className="w-full rounded-lg border border-neutral-700 py-2.5 font-medium text-neutral-200 hover:bg-neutral-900"
          >
            Checkout
          </button>
        </div>
      </div>

      {showCheckout && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-950 p-6">
            <h3 className="mb-1 text-lg font-semibold">Close tab · Table {table?.label}</h3>
            <p className="mb-4 text-sm text-neutral-500">
              Total due: <span className="text-neutral-100">${firedTotal.toFixed(2)}</span>
            </p>
            <p className="mb-4 text-xs text-neutral-500">
              This just records how the guest paid — no card is charged in-app.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "card", "other"] as const).map((method) => (
                <button
                  key={method}
                  disabled={closing}
                  onClick={() => closeTab(method)}
                  className="rounded-lg border border-neutral-700 py-2 text-sm capitalize hover:bg-neutral-900 disabled:opacity-40"
                >
                  {method}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCheckout(false)}
              className="mt-4 w-full text-center text-sm text-neutral-500 hover:text-neutral-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { MenuCategory, MenuItem, Order, OrderItem, RestaurantTable, StaffRole, Tab } from "@/lib/types";

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
  pending: "text-amber-600",
  ready: "text-emerald-600",
  served: "text-slate-400",
  cancelled: "text-slate-400 line-through",
};

export function POSView({
  tab,
  table,
  categories,
  menuItems,
  initialOrders,
  role,
}: {
  tab: Tab;
  table: RestaurantTable | null;
  categories: MenuCategory[];
  menuItems: MenuItem[];
  initialOrders: OrderWithItems[];
  role: StaffRole;
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string | "all">(categories[0]?.id ?? "all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders);
  const [sending, setSending] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [closing, setClosing] = useState(false);
  const [tabStatus, setTabStatus] = useState(tab.status);
  const [adjustment, setAdjustment] = useState(tab.adjustment);
  const [adjustmentNote, setAdjustmentNote] = useState(tab.adjustment_note ?? "");
  const [adjustmentInput, setAdjustmentInput] = useState(String(tab.adjustment));
  const [adjustmentNoteInput, setAdjustmentNoteInput] = useState(tab.adjustment_note ?? "");
  const [savingAdjustment, setSavingAdjustment] = useState(false);

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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tabs", filter: `id=eq.${tab.id}` },
        (payload) => {
          const updated = payload.new as Tab;
          setTabStatus(updated.status);
          setAdjustment(updated.adjustment);
          setAdjustmentNote(updated.adjustment_note ?? "");
        },
      )
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
  const billTotal = firedTotal + adjustment;

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

  function openCheckout() {
    setShowCheckout(true);
  }

  async function saveAdjustment() {
    const amount = parseFloat(adjustmentInput);
    if (Number.isNaN(amount)) return;
    setSavingAdjustment(true);
    try {
      const res = await fetch(`/api/tabs/${tab.id}/adjustment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, note: adjustmentNoteInput }),
      });
      if (res.ok) {
        setAdjustment(amount);
        setAdjustmentNote(adjustmentNoteInput);
      }
    } finally {
      setSavingAdjustment(false);
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
      <div className="flex flex-1 flex-col overflow-hidden border-r border-slate-200">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white p-3">
          <button
            onClick={() => setActiveCategory("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm shadow-sm transition-all ${activeCategory === "all" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100 hover:shadow"}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`shrink-0 truncate rounded-full px-3 py-1.5 text-sm shadow-sm transition-all ${activeCategory === c.id ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100 hover:shadow"}`}
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
              className="flex flex-col items-start gap-1 overflow-hidden rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition-shadow hover:border-blue-400 hover:bg-blue-50 hover:shadow-md"
            >
              <span className="w-full truncate font-medium text-slate-900">{item.name}</span>
              {item.description && <span className="w-full truncate text-xs text-slate-500">{item.description}</span>}
              <span className="mt-1 text-sm text-blue-600">${item.price.toFixed(2)}</span>
            </button>
          ))}
          {visibleItems.length === 0 && (
            <p className="col-span-full text-sm text-slate-500">No items in this category.</p>
          )}
        </div>
      </div>

      {/* Ticket / cart */}
      <div className="flex w-96 shrink-0 flex-col overflow-hidden bg-white">
        <div className="border-b border-slate-200 p-4">
          <h2 className="truncate font-semibold text-slate-900">Table {table?.label ?? "?"}</h2>
          <p className="truncate text-xs text-slate-500">{tab.guest_count} guests · Tab {tabStatus.replace("_", " ")}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {orders.length > 0 && (
            <div className="mb-4 space-y-3">
              <h3 className="text-xs font-medium uppercase text-slate-500">Sent to kitchen</h3>
              {orders
                .filter((o) => o.status !== "cancelled")
                .map((order) => (
                  <div key={order.id} className="rounded-lg border border-slate-200 p-2 text-sm shadow-sm">
                    {order.order_items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 py-0.5">
                        <span className="min-w-0 truncate text-slate-900">
                          {item.quantity}x {item.name_snapshot}
                          {item.note && <span className="text-slate-500"> ({item.note})</span>}
                        </span>
                        <span className={`shrink-0 ${STATUS_COLOR[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          )}

          <h3 className="text-xs font-medium uppercase text-slate-500">New items</h3>
          {cart.length === 0 && <p className="mt-2 text-sm text-slate-400">Tap menu items to add them.</p>}
          <div className="mt-2 space-y-2">
            {cart.map((line) => (
              <div key={line.key} className="rounded-lg border border-slate-200 p-2 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-slate-900">{line.name}</span>
                  <span className="shrink-0 text-sm text-slate-900">${(line.price * line.quantity).toFixed(2)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    onClick={() => updateLine(line.key, { quantity: Math.max(1, line.quantity - 1) })}
                    className="h-6 w-6 shrink-0 rounded bg-slate-100 text-sm text-slate-700 shadow-sm hover:bg-slate-200"
                  >
                    -
                  </button>
                  <span className="w-4 shrink-0 text-center text-sm text-slate-900">{line.quantity}</span>
                  <button
                    onClick={() => updateLine(line.key, { quantity: line.quantity + 1 })}
                    className="h-6 w-6 shrink-0 rounded bg-slate-100 text-sm text-slate-700 shadow-sm hover:bg-slate-200"
                  >
                    +
                  </button>
                  <input
                    value={line.note}
                    onChange={(e) => updateLine(line.key, { note: e.target.value })}
                    placeholder="note e.g. no onions"
                    className="ml-1 min-w-0 flex-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-blue-500"
                  />
                  <button onClick={() => removeLine(line.key)} className="shrink-0 text-xs text-red-500 hover:text-red-600">
                    remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 flex justify-between text-sm">
            <span className="text-slate-500">Fired</span>
            <span className="text-slate-900">${firedTotal.toFixed(2)}</span>
          </div>
          {cart.length > 0 && (
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-slate-500">New</span>
              <span className="text-slate-900">${cartTotal.toFixed(2)}</span>
            </div>
          )}
          {adjustment !== 0 && (
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-slate-500">
                {adjustment < 0 ? "Discount" : "Adjustment"}
                {adjustmentNote && <span className="text-slate-400"> ({adjustmentNote})</span>}
              </span>
              <span className={adjustment < 0 ? "text-red-500" : "text-slate-900"}>
                {adjustment < 0 ? "-" : ""}${Math.abs(adjustment).toFixed(2)}
              </span>
            </div>
          )}
          <div className="mb-4 flex justify-between text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>${(billTotal + cartTotal).toFixed(2)}</span>
          </div>

          <button
            disabled={cart.length === 0 || sending}
            onClick={sendToKitchen}
            className="mb-2 w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white shadow-sm transition-shadow hover:bg-blue-700 hover:shadow-md disabled:opacity-40 disabled:shadow-none"
          >
            {sending ? "Sending..." : "Send to kitchen"}
          </button>
          <button
            onClick={openCheckout}
            className="w-full rounded-lg border border-slate-300 py-2.5 font-medium text-slate-700 shadow-sm transition-shadow hover:bg-slate-50 hover:shadow-md"
          >
            Checkout
          </button>
        </div>
      </div>

      {showCheckout && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="mb-1 truncate text-lg font-semibold text-slate-900">Close tab · Table {table?.label}</h3>
            <p className="mb-4 text-sm text-slate-500">
              Total due: <span className="text-slate-900">${billTotal.toFixed(2)}</span>
              {adjustment !== 0 && (
                <span className="text-slate-400">
                  {" "}
                  (includes {adjustment < 0 ? "-" : "+"}${Math.abs(adjustment).toFixed(2)} adjustment)
                </span>
              )}
            </p>

            {role === "admin" && (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-medium uppercase text-slate-500">Adjust total (comp / discount)</p>
                <div className="flex gap-2">
                  <input
                    value={adjustmentInput}
                    onChange={(e) => setAdjustmentInput(e.target.value)}
                    placeholder="-5.00"
                    inputMode="decimal"
                    className="w-24 rounded-lg bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
                  />
                  <input
                    value={adjustmentNoteInput}
                    onChange={(e) => setAdjustmentNoteInput(e.target.value)}
                    placeholder="reason"
                    className="min-w-0 flex-1 rounded-lg bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
                  />
                  <button
                    onClick={saveAdjustment}
                    disabled={savingAdjustment}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-shadow hover:bg-blue-700 hover:shadow-md disabled:opacity-40 disabled:shadow-none"
                  >
                    Apply
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Negative = discount, positive = surcharge.</p>
              </div>
            )}

            <p className="mb-4 text-xs text-slate-500">
              This just records how the guest paid — no card is charged in-app.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "card", "other"] as const).map((method) => (
                <button
                  key={method}
                  disabled={closing}
                  onClick={() => closeTab(method)}
                  className="rounded-lg border border-slate-300 py-2 text-sm capitalize text-slate-700 shadow-sm transition-shadow hover:bg-slate-50 hover:shadow-md disabled:opacity-40 disabled:shadow-none"
                >
                  {method}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCheckout(false)}
              className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

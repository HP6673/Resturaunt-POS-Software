"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { MenuCategory, MenuItem, Order, OrderItem, RestaurantTable, StaffRole, Tab, TabStatus } from "@/lib/types";

type OrderWithItems = Order & { order_items: OrderItem[] };

interface CartLine {
  key: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  note: string;
}

const STAGE_OPTIONS: TabStatus[] = ["seated", "ordered", "eating", "needs_payment"];

const STAGE_LABEL: Record<TabStatus, string> = {
  seated: "Seated",
  ordered: "Ordered",
  eating: "Eating",
  needs_payment: "Payment",
  closed: "Closed",
};

const ITEM_STATUS_LABEL: Record<string, string> = {
  pending: "Fired",
  ready: "Ready",
  served: "Served",
  cancelled: "Removed",
};

function elapsedLabel(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function TableDetailModal({
  tabId,
  table,
  categories,
  menuItems,
  role,
  onClose,
}: {
  tabId: string;
  table: RestaurantTable;
  categories: MenuCategory[];
  menuItems: MenuItem[];
  role: StaffRole;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab | null>(null);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sending, setSending] = useState(false);
  const [stageSaving, setStageSaving] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [itemError, setItemError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const isAdmin = role === "admin";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [{ data: tabData }, { data: orderData }] = await Promise.all([
        supabaseBrowser.from("tabs").select("*").eq("id", tabId).maybeSingle(),
        supabaseBrowser.from("orders").select("*, order_items(*)").eq("tab_id", tabId).order("created_at"),
      ]);
      if (cancelled) return;
      if (tabData) setTab(tabData);
      if (orderData) setOrders(orderData as unknown as OrderWithItems[]);
    }

    load();

    const channel = supabaseBrowser
      .channel(`table-modal-${tabId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tabs", filter: `id=eq.${tabId}` },
        load,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabaseBrowser.removeChannel(channel);
    };
  }, [tabId]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

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
  const billTotal = firedTotal + (tab?.adjustment ?? 0);

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
          tabId,
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

  async function changeStage(status: TabStatus) {
    setStageSaving(true);
    try {
      await fetch(`/api/tabs/${tabId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } finally {
      setStageSaving(false);
    }
  }

  async function removeItem(item: OrderItem) {
    if (!confirm(`Remove ${item.name_snapshot} from this tab?`)) return;
    setItemError(null);
    const res = await fetch(`/api/order-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setItemError(data.error ?? "Failed to remove item");
    }
  }

  async function savePrice(item: OrderItem) {
    const price = parseFloat(editPrice);
    if (Number.isNaN(price) || price < 0) {
      setItemError("Enter a valid price");
      return;
    }
    setItemError(null);
    const res = await fetch(`/api/order-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setItemError(data.error ?? "Failed to update price");
      return;
    }
    setEditingItemId(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Table {table.label}</h2>
            {tab && (
              <p className="text-xs text-slate-500">
                Open {elapsedLabel(tab.opened_at)} · In {STAGE_LABEL[tab.status]} for{" "}
                {elapsedLabel(tab.status_changed_at)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/pos/${tabId}`} className="text-sm text-blue-600 hover:underline">
              Open full ticket ↗
            </Link>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        {!tab ? (
          <div className="p-6 text-sm text-slate-400">Loading…</div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Tab contents + stage controls */}
            <div className="flex w-96 shrink-0 flex-col overflow-hidden border-r border-slate-200">
              <div className="border-b border-slate-200 p-4">
                <p className="mb-2 text-xs font-medium uppercase text-slate-500">Stage</p>
                <div className="flex flex-wrap gap-1.5">
                  {STAGE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      disabled={stageSaving}
                      onClick={() => changeStage(s)}
                      className={`rounded-full px-3 py-1 text-xs disabled:opacity-40 ${
                        tab.status === s
                          ? "bg-blue-600 text-white"
                          : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                      }`}
                    >
                      {STAGE_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <p className="mb-2 text-xs font-medium uppercase text-slate-500">Tab</p>
                {itemError && <p className="mb-2 text-sm text-red-600">{itemError}</p>}
                {orders.filter((o) => o.status !== "cancelled").length === 0 && (
                  <p className="text-sm text-slate-400">Nothing ordered yet.</p>
                )}
                <div className="space-y-3">
                  {orders
                    .filter((o) => o.status !== "cancelled")
                    .map((order) => (
                      <div key={order.id} className="rounded-lg border border-slate-200 p-2 text-sm">
                        {order.order_items.map((item) => (
                          <div key={item.id} className="py-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className={item.status === "cancelled" ? "text-slate-400 line-through" : "text-slate-900"}>
                                {item.quantity}x {item.name_snapshot}
                                {item.note && <span className="text-slate-500"> ({item.note})</span>}
                              </span>
                              {editingItemId === item.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    value={editPrice}
                                    onChange={(e) => setEditPrice(e.target.value)}
                                    inputMode="decimal"
                                    className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                                    autoFocus
                                  />
                                  <button onClick={() => savePrice(item)} className="text-xs text-blue-600 hover:underline">
                                    Save
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-900">${item.price_snapshot.toFixed(2)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 pl-4 text-[11px]">
                              <span className="text-slate-400">{ITEM_STATUS_LABEL[item.status]}</span>
                              {isAdmin && item.status !== "cancelled" && editingItemId !== item.id && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingItemId(item.id);
                                      setEditPrice(String(item.price_snapshot));
                                      setItemError(null);
                                    }}
                                    className="text-blue-600 hover:underline"
                                  >
                                    Edit price
                                  </button>
                                  <button onClick={() => removeItem(item)} className="text-red-500 hover:underline">
                                    Remove
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>

                {cart.length > 0 && (
                  <>
                    <p className="mb-2 mt-4 text-xs font-medium uppercase text-slate-500">New (not sent yet)</p>
                    <div className="space-y-2">
                      {cart.map((line) => (
                        <div key={line.key} className="rounded-lg border border-slate-200 p-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-900">{line.name}</span>
                            <span className="text-sm text-slate-900">${(line.price * line.quantity).toFixed(2)}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              onClick={() => updateLine(line.key, { quantity: Math.max(1, line.quantity - 1) })}
                              className="h-6 w-6 rounded bg-slate-100 text-sm text-slate-700 hover:bg-slate-200"
                            >
                              -
                            </button>
                            <span className="w-4 text-center text-sm text-slate-900">{line.quantity}</span>
                            <button
                              onClick={() => updateLine(line.key, { quantity: line.quantity + 1 })}
                              className="h-6 w-6 rounded bg-slate-100 text-sm text-slate-700 hover:bg-slate-200"
                            >
                              +
                            </button>
                            <button onClick={() => removeLine(line.key)} className="ml-auto text-xs text-red-500 hover:text-red-600">
                              remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-slate-200 p-4">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-500">Fired</span>
                  <span className="text-slate-900">${firedTotal.toFixed(2)}</span>
                </div>
                {tab.adjustment !== 0 && (
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-500">Adjustment</span>
                    <span className="text-slate-900">${tab.adjustment.toFixed(2)}</span>
                  </div>
                )}
                {cart.length > 0 && (
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-500">New</span>
                    <span className="text-slate-900">${cartTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="mb-3 flex justify-between text-base font-semibold text-slate-900">
                  <span>Total</span>
                  <span>${(billTotal + cartTotal).toFixed(2)}</span>
                </div>
                <button
                  disabled={cart.length === 0 || sending}
                  onClick={sendToKitchen}
                  className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  {sending ? "Sending..." : "Send to kitchen"}
                </button>
              </div>
            </div>

            {/* Menu browser to add items */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex gap-1 overflow-x-auto border-b border-slate-200 p-3">
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${activeCategory === "all" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(c.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${activeCategory === c.id ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3">
                {visibleItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="flex flex-col items-start gap-1 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-400 hover:bg-blue-50"
                  >
                    <span className="font-medium text-slate-900">{item.name}</span>
                    <span className="text-sm text-blue-600">${item.price.toFixed(2)}</span>
                  </button>
                ))}
                {visibleItems.length === 0 && (
                  <p className="col-span-full text-sm text-slate-500">No items in this category.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

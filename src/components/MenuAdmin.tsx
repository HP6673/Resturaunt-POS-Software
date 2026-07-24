"use client";

import { useState } from "react";
import type { MenuCategory, MenuItem } from "@/lib/types";

export function MenuAdmin({
  initialCategories,
  initialItems,
}: {
  initialCategories: MenuCategory[];
  initialItems: MenuItem[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItem, setNewItem] = useState({ name: "", description: "", price: "", categoryId: categories[0]?.id ?? "" });
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingItem, setSavingItem] = useState(false);

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      const res = await fetch("/api/menu-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName, sortOrder: categories.length }),
      });
      const data = await res.json();
      if (res.ok) {
        setCategories((prev) => [...prev, { id: data.id, name: newCategoryName, sort_order: prev.length }]);
        setNewCategoryName("");
      }
    } finally {
      setSavingCategory(false);
    }
  }

  async function addItem() {
    const price = parseFloat(newItem.price);
    if (!newItem.name.trim() || Number.isNaN(price)) return;
    setSavingItem(true);
    try {
      const res = await fetch("/api/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newItem.name,
          description: newItem.description || null,
          price,
          categoryId: newItem.categoryId || null,
          sortOrder: items.length,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setItems((prev) => [
          ...prev,
          {
            id: data.id,
            name: newItem.name,
            description: newItem.description || null,
            price,
            category_id: newItem.categoryId || null,
            is_available: true,
            sort_order: prev.length,
          },
        ]);
        setNewItem({ name: "", description: "", price: "", categoryId: newItem.categoryId });
      }
    } finally {
      setSavingItem(false);
    }
  }

  async function toggleAvailable(item: MenuItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_available: !i.is_available } : i)));
    await fetch(`/api/menu-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !item.is_available }),
    });
  }

  async function updatePrice(item: MenuItem, price: number) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, price } : i)));
    await fetch(`/api/menu-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price }),
    });
  }

  async function deleteItem(item: MenuItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await fetch(`/api/menu-items/${item.id}`, { method: "DELETE" });
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-xl font-semibold text-slate-900">Menu management</h1>

        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">Categories</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c.id} className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
                {c.name}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              className="flex-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
            />
            <button
              onClick={addCategory}
              disabled={savingCategory}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </section>

        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">Add menu item</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input
              value={newItem.name}
              onChange={(e) => setNewItem((s) => ({ ...s, name: e.target.value }))}
              placeholder="Name"
              className="col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500 sm:col-span-1"
            />
            <input
              value={newItem.description}
              onChange={(e) => setNewItem((s) => ({ ...s, description: e.target.value }))}
              placeholder="Description"
              className="col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500 sm:col-span-1"
            />
            <input
              value={newItem.price}
              onChange={(e) => setNewItem((s) => ({ ...s, price: e.target.value }))}
              placeholder="Price"
              inputMode="decimal"
              className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
            />
            <select
              value={newItem.categoryId}
              onChange={(e) => setNewItem((s) => ({ ...s, categoryId: e.target.value }))}
              className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={addItem}
            disabled={savingItem}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Add item
          </button>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">Items</h2>
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div>
                  <p className={`font-medium ${!item.is_available ? "text-slate-400 line-through" : "text-slate-900"}`}>
                    {item.name}
                  </p>
                  {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={item.price}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!Number.isNaN(value) && value !== item.price) updatePrice(item, value);
                    }}
                    className="w-20 rounded-lg bg-slate-50 px-2 py-1 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
                  />
                  <button
                    onClick={() => toggleAvailable(item)}
                    className={`rounded-full px-3 py-1 text-xs ${
                      item.is_available ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {item.is_available ? "Available" : "Sold out"}
                  </button>
                  <button onClick={() => deleteItem(item)} className="text-xs text-red-500 hover:text-red-600">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

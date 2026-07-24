"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fetchOpenTabsSummary, type OpenTabSummary } from "@/lib/tabsSummary";
import { TableDetailModal } from "@/components/TableDetailModal";
import type { Floor, MenuCategory, MenuItem, RestaurantTable, StaffRole, TabStatus } from "@/lib/types";

const STATUS_STYLE: Record<"empty" | TabStatus, string> = {
  empty: "bg-white border-slate-200 hover:bg-slate-50",
  seated: "bg-sky-50 border-sky-400 hover:bg-sky-100",
  ordered: "bg-amber-50 border-amber-400 hover:bg-amber-100",
  eating: "bg-emerald-50 border-emerald-400 hover:bg-emerald-100",
  needs_payment: "bg-rose-50 border-rose-400 hover:bg-rose-100",
  closed: "bg-white border-slate-200 hover:bg-slate-50",
};

const STATUS_LABEL: Record<"empty" | TabStatus, string> = {
  empty: "Empty",
  seated: "Seated",
  ordered: "Ordered",
  eating: "Eating",
  needs_payment: "Payment",
  closed: "Empty",
};

const STATUS_DOT: Record<"empty" | TabStatus, string> = {
  empty: "border-slate-200 bg-white",
  seated: "border-sky-400 bg-sky-50",
  ordered: "border-amber-400 bg-amber-50",
  eating: "border-emerald-400 bg-emerald-50",
  needs_payment: "border-rose-400 bg-rose-50",
  closed: "border-slate-200 bg-white",
};

export function TablesBoard({
  floors,
  tables,
  staffNames,
  categories,
  menuItems,
  role,
}: {
  floors: Floor[];
  tables: RestaurantTable[];
  staffNames: Record<string, string>;
  categories: MenuCategory[];
  menuItems: MenuItem[];
  role: StaffRole;
}) {
  const [activeFloor, setActiveFloor] = useState<string>(floors[0]?.id ?? "");
  const [tabsByTable, setTabsByTable] = useState<Record<string, OpenTabSummary>>({});
  const [busyTableId, setBusyTableId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ tabId: string; table: RestaurantTable } | null>(null);
  const loadingRef = useRef(false);

  async function refresh() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const summary = await fetchOpenTabsSummary();
      const map: Record<string, OpenTabSummary> = {};
      for (const tab of summary) map[tab.table_id] = tab;
      setTabsByTable(map);
    } finally {
      loadingRef.current = false;
    }
  }

  useEffect(() => {
    refresh();
    const channel = supabaseBrowser
      .channel("tables-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "tabs" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, refresh)
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  async function handleClick(table: RestaurantTable) {
    const existing = tabsByTable[table.id];
    if (existing) {
      setSelected({ tabId: existing.id, table });
      return;
    }
    setBusyTableId(table.id);
    try {
      const res = await fetch("/api/tabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: table.id, guestCount: 2 }),
      });
      const data = await res.json();
      if (res.ok) {
        setSelected({ tabId: data.id, table });
      }
    } finally {
      setBusyTableId(null);
    }
  }

  const visibleTables = tables.filter((t) => t.floor_id === activeFloor);

  return (
    <div className="relative flex-1 overflow-auto p-6">
      {floors.length > 1 && (
        <div className="mb-4 flex gap-1">
          {floors.map((floor) => (
            <button
              key={floor.id}
              onClick={() => setActiveFloor(floor.id)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                activeFloor === floor.id ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              {floor.name}
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-500">
        {(["empty", "seated", "ordered", "eating", "needs_payment"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded border ${STATUS_DOT[s]}`} /> {STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      <div className="relative h-[70vh] min-h-[500px] w-full rounded-xl border border-slate-200 bg-blue-50/40">
        {visibleTables.map((table) => {
          const tab = tabsByTable[table.id];
          const status = tab ? tab.status : "empty";
          const radius = table.shape === "round" ? "9999px" : "0.5rem";
          return (
            <button
              key={table.id}
              onClick={() => handleClick(table)}
              disabled={busyTableId === table.id}
              style={{
                left: `${table.pos_x}%`,
                top: `${table.pos_y}%`,
                width: `${table.width}px`,
                height: `${table.height}px`,
                borderRadius: radius,
              }}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 border p-2 text-sm shadow-sm transition-colors disabled:opacity-50 ${STATUS_STYLE[status]}`}
            >
              <span className="text-base font-semibold text-slate-900">Table {table.label}</span>
              <span className="text-xs text-slate-500">{table.seats} seats</span>
              {tab && (
                <>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {STATUS_LABEL[status]}
                  </span>
                  <span className="text-sm font-medium text-slate-900">${tab.total.toFixed(2)}</span>
                  {tab.server_id && (
                    <span className="text-[10px] text-slate-500">{staffNames[tab.server_id] ?? ""}</span>
                  )}
                </>
              )}
            </button>
          );
        })}
        {visibleTables.length === 0 && (
          <p className="p-6 text-sm text-slate-400">No tables on this floor yet.</p>
        )}
      </div>

      {selected && (
        <TableDetailModal
          tabId={selected.tabId}
          table={selected.table}
          categories={categories}
          menuItems={menuItems}
          role={role}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

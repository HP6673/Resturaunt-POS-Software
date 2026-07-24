"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fetchOpenTabsSummary, type OpenTabSummary } from "@/lib/tabsSummary";
import type { RestaurantTable } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  available: "bg-neutral-800 border-neutral-700 hover:bg-neutral-700",
  open: "bg-emerald-900/60 border-emerald-600 hover:bg-emerald-900",
  needs_payment: "bg-amber-900/60 border-amber-500 hover:bg-amber-900",
};

export function TablesBoard({
  tables,
  staffNames,
}: {
  tables: RestaurantTable[];
  staffNames: Record<string, string>;
}) {
  const router = useRouter();
  const [tabsByTable, setTabsByTable] = useState<Record<string, OpenTabSummary>>({});
  const [busyTableId, setBusyTableId] = useState<string | null>(null);
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
      router.push(`/pos/${existing.id}`);
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
        router.push(`/pos/${data.id}`);
      }
    } finally {
      setBusyTableId(null);
    }
  }

  return (
    <div className="relative flex-1 overflow-auto p-6">
      <div className="mb-4 flex gap-4 text-xs text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-neutral-700 bg-neutral-800" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-emerald-600 bg-emerald-900/60" /> Open tab
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-amber-500 bg-amber-900/60" /> Needs payment
        </span>
      </div>
      <div className="relative h-[70vh] min-h-[500px] w-full rounded-xl border border-neutral-800 bg-neutral-900/40">
        {tables.map((table) => {
          const tab = tabsByTable[table.id];
          const status = tab ? tab.status : "available";
          return (
            <button
              key={table.id}
              onClick={() => handleClick(table)}
              disabled={busyTableId === table.id}
              style={{ left: `${table.pos_x}%`, top: `${table.pos_y}%` }}
              className={`absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-lg border p-3 text-sm shadow transition-colors disabled:opacity-50 ${STATUS_STYLE[status]}`}
            >
              <span className="text-base font-semibold">Table {table.label}</span>
              <span className="text-xs text-neutral-400">{table.seats} seats</span>
              {tab && (
                <>
                  <span className="text-sm font-medium text-neutral-100">${tab.total.toFixed(2)}</span>
                  {tab.server_id && (
                    <span className="text-[10px] text-neutral-400">{staffNames[tab.server_id] ?? ""}</span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import type { RestaurantTable } from "@/lib/types";

export function FloorPlanEditor({ initialTables }: { initialTables: RestaurantTable[] }) {
  const [tables, setTables] = useState(initialTables);
  const [dragId, setDragId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newSeats, setNewSeats] = useState("4");
  const boardRef = useRef<HTMLDivElement>(null);

  function clamp(v: number) {
    return Math.min(95, Math.max(3, v));
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragId || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100);
    setTables((prev) => prev.map((t) => (t.id === dragId ? { ...t, pos_x: x, pos_y: y } : t)));
  }

  async function onPointerUp() {
    if (!dragId) return;
    const table = tables.find((t) => t.id === dragId);
    setDragId(null);
    if (!table) return;
    await fetch(`/api/tables/${table.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posX: table.pos_x, posY: table.pos_y }),
    });
  }

  async function addTable() {
    if (!newLabel.trim()) return;
    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel, seats: parseInt(newSeats, 10) || 4, posX: 50, posY: 50 }),
    });
    const data = await res.json();
    if (res.ok) {
      setTables((prev) => [
        ...prev,
        { id: data.id, label: newLabel, seats: parseInt(newSeats, 10) || 4, pos_x: 50, pos_y: 50 },
      ]);
      setNewLabel("");
      setNewSeats("4");
    }
  }

  async function removeTable(id: string) {
    setTables((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tables/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex-1 p-6">
      <div className="mb-4 flex items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Table label</label>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="w-28 rounded-lg bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800 focus:outline-none focus:ring-emerald-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Seats</label>
          <input
            value={newSeats}
            onChange={(e) => setNewSeats(e.target.value)}
            type="number"
            className="w-20 rounded-lg bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800 focus:outline-none focus:ring-emerald-600"
          />
        </div>
        <button onClick={addTable} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium">
          Add table
        </button>
        <p className="ml-4 text-xs text-neutral-500">Drag tables to arrange your floor plan. Position saves automatically.</p>
      </div>

      <div
        ref={boardRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className="relative h-[70vh] min-h-[500px] w-full touch-none rounded-xl border border-neutral-800 bg-neutral-900/40"
      >
        {tables.map((table) => (
          <div
            key={table.id}
            onPointerDown={() => setDragId(table.id)}
            style={{ left: `${table.pos_x}%`, top: `${table.pos_y}%` }}
            className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-sm active:cursor-grabbing"
          >
            <span className="font-semibold">Table {table.label}</span>
            <span className="text-xs text-neutral-400">{table.seats} seats</span>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => removeTable(table.id)}
              className="mt-1 text-[10px] text-red-400 hover:text-red-300"
            >
              remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

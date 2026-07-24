"use client";

import { useRef, useState } from "react";
import type { Floor, RestaurantTable, TableShape } from "@/lib/types";

interface EditForm {
  label: string;
  seats: string;
  shape: TableShape;
  width: string;
  height: string;
}

export function FloorPlanEditor({
  initialFloors,
  initialTables,
}: {
  initialFloors: Floor[];
  initialTables: RestaurantTable[];
}) {
  const [floors, setFloors] = useState(initialFloors);
  const [activeFloor, setActiveFloor] = useState<string>(initialFloors[0]?.id ?? "");
  const [tables, setTables] = useState(initialTables);
  const [dragId, setDragId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newSeats, setNewSeats] = useState("4");
  const [newShape, setNewShape] = useState<TableShape>("square");
  const [newFloorName, setNewFloorName] = useState("");
  const [addingFloor, setAddingFloor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
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
    if (!newLabel.trim() || !activeFloor) return;
    const seats = parseInt(newSeats, 10) || 4;
    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        floorId: activeFloor,
        label: newLabel,
        seats,
        shape: newShape,
        posX: 50,
        posY: 50,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setTables((prev) => [
        ...prev,
        {
          id: data.id,
          floor_id: activeFloor,
          label: newLabel,
          seats,
          pos_x: 50,
          pos_y: 50,
          shape: newShape,
          width: 96,
          height: 96,
        },
      ]);
      setNewLabel("");
      setNewSeats("4");
      setNewShape("square");
    }
  }

  async function removeTable(id: string) {
    setTables((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tables/${id}`, { method: "DELETE" });
  }

  async function addFloor() {
    if (!newFloorName.trim()) return;
    setAddingFloor(true);
    try {
      const res = await fetch("/api/floors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFloorName, sortOrder: floors.length }),
      });
      const data = await res.json();
      if (res.ok) {
        const floor = { id: data.id, name: newFloorName, sort_order: floors.length };
        setFloors((prev) => [...prev, floor]);
        setActiveFloor(floor.id);
        setNewFloorName("");
      }
    } finally {
      setAddingFloor(false);
    }
  }

  function openEdit(table: RestaurantTable) {
    setEditingId(table.id);
    setEditForm({
      label: table.label,
      seats: String(table.seats),
      shape: table.shape,
      width: String(table.width),
      height: String(table.height),
    });
  }

  async function saveEdit() {
    if (!editingId || !editForm) return;
    const seats = parseInt(editForm.seats, 10) || 1;
    const width = parseInt(editForm.width, 10) || 96;
    const height = parseInt(editForm.height, 10) || 96;
    setTables((prev) =>
      prev.map((t) =>
        t.id === editingId ? { ...t, label: editForm.label, seats, shape: editForm.shape, width, height } : t,
      ),
    );
    setEditingId(null);
    await fetch(`/api/tables/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editForm.label, seats, shape: editForm.shape, width, height }),
    });
  }

  const visibleTables = tables.filter((t) => t.floor_id === activeFloor);

  return (
    <div className="flex-1 p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
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
        <input
          value={newFloorName}
          onChange={(e) => setNewFloorName(e.target.value)}
          placeholder="New floor / room name"
          className="w-44 rounded-lg bg-white px-3 py-1.5 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
        />
        <button
          onClick={addFloor}
          disabled={addingFloor}
          className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-40"
        >
          Add floor
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Table label</label>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="w-28 rounded-lg bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Seats</label>
          <input
            value={newSeats}
            onChange={(e) => setNewSeats(e.target.value)}
            type="number"
            className="w-20 rounded-lg bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Shape</label>
          <select
            value={newShape}
            onChange={(e) => setNewShape(e.target.value as TableShape)}
            className="rounded-lg bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
          >
            <option value="square">Square</option>
            <option value="round">Round</option>
            <option value="rectangle">Rectangle</option>
          </select>
        </div>
        <button onClick={addTable} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Add table
        </button>
        <p className="ml-2 text-xs text-slate-500">Drag to reposition. Click a table to edit its size/shape.</p>
      </div>

      <div
        ref={boardRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className="relative h-[70vh] min-h-[500px] w-full touch-none rounded-xl border border-slate-200 bg-blue-50/40"
      >
        {visibleTables.map((table) => (
          <div
            key={table.id}
            onPointerDown={() => setDragId(table.id)}
            onClick={() => openEdit(table)}
            style={{
              left: `${table.pos_x}%`,
              top: `${table.pos_y}%`,
              width: `${table.width}px`,
              height: `${table.height}px`,
              borderRadius: table.shape === "round" ? "9999px" : "0.5rem",
            }}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center justify-center gap-1 border border-slate-200 bg-white p-2 text-sm shadow-sm active:cursor-grabbing"
          >
            <span className="font-semibold text-slate-900">Table {table.label}</span>
            <span className="text-xs text-slate-500">{table.seats} seats</span>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                removeTable(table.id);
              }}
              className="mt-1 text-[10px] text-red-500 hover:text-red-600"
            >
              remove
            </button>
          </div>
        ))}
        {visibleTables.length === 0 && (
          <p className="p-6 text-sm text-slate-400">No tables on this floor yet. Add one above.</p>
        )}
      </div>

      {editingId && editForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Edit table</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Label</label>
                <input
                  value={editForm.label}
                  onChange={(e) => setEditForm((f) => f && { ...f, label: e.target.value })}
                  className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-slate-500">Seats</label>
                  <input
                    type="number"
                    value={editForm.seats}
                    onChange={(e) => setEditForm((f) => f && { ...f, seats: e.target.value })}
                    className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-slate-500">Shape</label>
                  <select
                    value={editForm.shape}
                    onChange={(e) => setEditForm((f) => f && { ...f, shape: e.target.value as TableShape })}
                    className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="square">Square</option>
                    <option value="round">Round</option>
                    <option value="rectangle">Rectangle</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-slate-500">Width (px)</label>
                  <input
                    type="number"
                    value={editForm.width}
                    onChange={(e) => setEditForm((f) => f && { ...f, width: e.target.value })}
                    className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-slate-500">Height (px)</label>
                  <input
                    type="number"
                    value={editForm.height}
                    onChange={(e) => setEditForm((f) => f && { ...f, height: e.target.value })}
                    className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={saveEdit}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

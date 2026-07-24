"use client";

import { useState } from "react";
import type { Staff, StaffRole } from "@/lib/types";

export function StaffAdmin({
  initialStaff,
  currentStaffId,
}: {
  initialStaff: Staff[];
  currentStaffId: string;
}) {
  const [staff, setStaff] = useState(initialStaff);
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("server");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetPin, setResetPin] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);
  const [rowErrorId, setRowErrorId] = useState<string | null>(null);

  async function addStaff() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError("PIN must be exactly 6 digits");
      return;
    }
    if (pin !== pinConfirm) {
      setError("PINs don't match");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add employee");
        return;
      }
      setStaff((prev) => [...prev, { id: data.id, name: data.name, role: data.role, active: data.active, pin }]);
      setName("");
      setPin("");
      setPinConfirm("");
      setRole("server");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(member: Staff) {
    setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, active: !s.active } : s)));
    await fetch(`/api/staff/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !member.active }),
    });
  }

  async function deleteStaff(member: Staff) {
    if (member.id === currentStaffId) return;
    if (!confirm(`Permanently delete ${member.name}? This can't be undone.`)) return;
    setRowError(null);
    setRowErrorId(null);
    const res = await fetch(`/api/staff/${member.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setRowError(data.error ?? "Failed to delete employee");
      setRowErrorId(member.id);
      return;
    }
    setStaff((prev) => prev.filter((s) => s.id !== member.id));
  }

  async function changeRole(member: Staff, newRole: StaffRole) {
    setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, role: newRole } : s)));
    await fetch(`/api/staff/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
  }

  async function submitResetPin(id: string) {
    setRowError(null);
    if (!/^\d{6}$/.test(resetPin)) {
      setRowError("PIN must be exactly 6 digits");
      return;
    }
    const res = await fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: resetPin }),
    });
    const data = await res.json();
    if (!res.ok) {
      setRowError(data.error ?? "Failed to reset PIN");
      return;
    }
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, pin: resetPin } : s)));
    setResettingId(null);
    setResetPin("");
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-xl font-semibold text-slate-900">Staff</h1>

        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">Add employee</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500 sm:col-span-1"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
            >
              <option value="server">Server</option>
              <option value="kitchen">Kitchen</option>
              <option value="admin">Admin</option>
            </select>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit PIN"
              inputMode="numeric"
              className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
            />
            <input
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Confirm PIN"
              inputMode="numeric"
              className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
            />
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            onClick={addStaff}
            disabled={saving}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Add employee
          </button>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">Employees</h2>
          <div className="space-y-2">
            {staff.map((member) => (
              <div key={member.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`font-medium ${!member.active ? "text-slate-400 line-through" : "text-slate-900"}`}>
                      {member.name}
                      {member.id === currentStaffId && <span className="ml-2 text-xs text-blue-600">(you)</span>}
                    </p>
                    <p className="font-mono text-xs text-slate-400">PIN {member.pin}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(e) => changeRole(member, e.target.value as StaffRole)}
                      className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
                    >
                      <option value="server">Server</option>
                      <option value="kitchen">Kitchen</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => {
                        setResettingId(resettingId === member.id ? null : member.id);
                        setResetPin("");
                        setRowError(null);
                        setRowErrorId(null);
                      }}
                      className="rounded-full px-3 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100"
                    >
                      Reset PIN
                    </button>
                    <button
                      onClick={() => toggleActive(member)}
                      disabled={member.id === currentStaffId}
                      className={`rounded-full px-3 py-1 text-xs disabled:opacity-40 ${
                        member.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {member.active ? "Active" : "Deactivated"}
                    </button>
                    <button
                      onClick={() => deleteStaff(member)}
                      disabled={member.id === currentStaffId}
                      className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-600 hover:bg-red-100 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {rowErrorId === member.id && resettingId !== member.id && (
                  <p className="mt-2 text-sm text-red-600">{rowError}</p>
                )}
                {resettingId === member.id && (
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                    <input
                      value={resetPin}
                      onChange={(e) => setResetPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="New 6-digit PIN"
                      inputMode="numeric"
                      className="w-32 rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-blue-500"
                    />
                    <button
                      onClick={() => submitResetPin(member.id)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Save
                    </button>
                    {rowError && <p className="text-sm text-red-600">{rowError}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

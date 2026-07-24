"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(pinValue: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        setPin("");
        return;
      }
      const next = searchParams.get("next");
      if (next) {
        router.replace(next);
      } else {
        router.replace(data.role === "kitchen" ? "/kitchen" : "/tables");
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function press(digit: string) {
    if (loading) return;
    const next = (pin + digit).slice(0, 6);
    setPin(next);
  }

  function backspace() {
    setPin((p) => p.slice(0, -1));
  }

  function clear() {
    setPin("");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 text-neutral-100">
      <h1 className="mb-1 text-2xl font-semibold">Restaurant POS</h1>
      <p className="mb-8 text-sm text-neutral-400">Enter your staff PIN</p>

      <div className="mb-6 flex h-14 w-56 items-center justify-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full ${i < pin.length ? "bg-emerald-500" : "bg-neutral-700"}`}
          />
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            className="h-16 w-16 rounded-xl bg-neutral-800 text-xl font-medium hover:bg-neutral-700 active:bg-neutral-600"
          >
            {d}
          </button>
        ))}
        <button
          onClick={clear}
          className="h-16 w-16 rounded-xl bg-neutral-900 text-sm text-neutral-400 hover:bg-neutral-800"
        >
          Clear
        </button>
        <button
          onClick={() => press("0")}
          className="h-16 w-16 rounded-xl bg-neutral-800 text-xl font-medium hover:bg-neutral-700 active:bg-neutral-600"
        >
          0
        </button>
        <button
          onClick={backspace}
          className="h-16 w-16 rounded-xl bg-neutral-900 text-sm text-neutral-400 hover:bg-neutral-800"
        >
          ⌫
        </button>
      </div>

      <button
        disabled={pin.length === 0 || loading}
        onClick={() => submit(pin)}
        className="mt-8 w-56 rounded-lg bg-emerald-600 py-3 font-medium disabled:opacity-40"
      >
        {loading ? "Checking..." : "Log in"}
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

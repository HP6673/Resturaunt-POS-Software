"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { StaffRole } from "@/lib/types";

const NAV: { href: string; label: string; roles: StaffRole[] }[] = [
  { href: "/tables", label: "Tables", roles: ["admin", "server"] },
  { href: "/kitchen", label: "Kitchen", roles: ["admin", "server", "kitchen"] },
  { href: "/admin/menu", label: "Menu", roles: ["admin"] },
  { href: "/admin/tables", label: "Floor plan", roles: ["admin"] },
];

export function AppHeader({ name, role }: { name: string; role: StaffRole }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const links = NAV.filter((item) => item.roles.includes(role));

  return (
    <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100">
      <div className="flex items-center gap-6">
        <span className="font-semibold tracking-tight">Restaurant POS</span>
        <nav className="flex gap-1">
          {links.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  active ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-neutral-400">
          {name} · <span className="uppercase text-neutral-500">{role}</span>
        </span>
        <button
          onClick={logout}
          className="rounded-md border border-neutral-800 px-3 py-1.5 text-neutral-300 hover:bg-neutral-900"
        >
          Log out
        </button>
      </div>
    </header>
  );
}

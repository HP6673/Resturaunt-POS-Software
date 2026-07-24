import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { getRevenueStats, getTopItems } from "@/lib/reports";

export default async function AdminReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/tables");

  const admin = supabaseAdmin();
  const [stats, topItems] = await Promise.all([getRevenueStats(admin), getTopItems(admin, 24 * 30)]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <AppHeader name={session.name} role={session.role} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-xl font-semibold text-slate-900">Reports</h1>

          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase text-slate-500">{s.label}</p>
                <p className="mt-2 text-2xl font-semibold text-blue-700">${s.revenue.toFixed(2)}</p>
                <p className="mt-1 text-xs text-slate-500">{s.tabCount} tabs closed</p>
                <p className="text-xs text-slate-500">${s.averageTab.toFixed(2)} average tab</p>
              </div>
            ))}
          </div>

          <section>
            <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">Top items (last 30 days)</h2>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-2 font-medium">Item</th>
                    <th className="px-4 py-2 font-medium">Qty sold</th>
                    <th className="px-4 py-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((item) => (
                    <tr key={item.name} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2 text-slate-900">{item.name}</td>
                      <td className="px-4 py-2 text-slate-500">{item.quantity}</td>
                      <td className="px-4 py-2 text-slate-900">${item.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                  {topItems.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-400">
                        No sales yet in this window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

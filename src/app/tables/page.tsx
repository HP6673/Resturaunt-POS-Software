import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { TablesBoard } from "@/components/TablesBoard";

export default async function TablesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const admin = supabaseAdmin();
  const [{ data: floors }, { data: tables }, { data: staff }] = await Promise.all([
    admin.from("floors").select("*").order("sort_order"),
    admin.from("restaurant_tables").select("*").order("label"),
    admin.from("staff").select("id, name"),
  ]);

  const staffNames = Object.fromEntries((staff ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <AppHeader name={session.name} role={session.role} />
      <TablesBoard floors={floors ?? []} tables={tables ?? []} staffNames={staffNames} />
    </div>
  );
}

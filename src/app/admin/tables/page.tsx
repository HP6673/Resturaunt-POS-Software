import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { FloorPlanEditor } from "@/components/FloorPlanEditor";

export default async function AdminTablesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/tables");

  const admin = supabaseAdmin();
  const [{ data: floors }, { data: tables }] = await Promise.all([
    admin.from("floors").select("*").order("sort_order"),
    admin.from("restaurant_tables").select("*").order("label"),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <AppHeader name={session.name} role={session.role} />
      <FloorPlanEditor initialFloors={floors ?? []} initialTables={tables ?? []} />
    </div>
  );
}

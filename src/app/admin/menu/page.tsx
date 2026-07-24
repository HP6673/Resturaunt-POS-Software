import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { MenuAdmin } from "@/components/MenuAdmin";

export default async function AdminMenuPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/tables");

  const admin = supabaseAdmin();
  const [{ data: categories }, { data: items }] = await Promise.all([
    admin.from("menu_categories").select("*").order("sort_order"),
    admin.from("menu_items").select("*").order("sort_order"),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <AppHeader name={session.name} role={session.role} />
      <MenuAdmin initialCategories={categories ?? []} initialItems={items ?? []} />
    </div>
  );
}

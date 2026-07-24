import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { StaffAdmin } from "@/components/StaffAdmin";

export default async function AdminStaffPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/tables");

  const admin = supabaseAdmin();
  const { data: staff } = await admin
    .from("staff")
    .select("id, name, role, active")
    .order("created_at");

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <AppHeader name={session.name} role={session.role} />
      <StaffAdmin initialStaff={staff ?? []} currentStaffId={session.staffId} />
    </div>
  );
}

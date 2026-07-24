import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { decryptPin } from "@/lib/pinCrypto";
import { AppHeader } from "@/components/AppHeader";
import { StaffAdmin } from "@/components/StaffAdmin";

export default async function AdminStaffPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/tables");

  const admin = supabaseAdmin();
  const { data: staff } = await admin
    .from("staff")
    .select("id, name, role, active, pin_encrypted")
    .order("created_at");

  const staffWithPins = (staff ?? []).map((s) => {
    let pin = "????";
    try {
      pin = decryptPin(s.pin_encrypted);
    } catch {
      // Left over from before PIN encryption was added — needs a reset.
    }
    return { id: s.id, name: s.name, role: s.role, active: s.active, pin };
  });

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <AppHeader name={session.name} role={session.role} />
      <StaffAdmin initialStaff={staffWithPins} currentStaffId={session.staffId} />
    </div>
  );
}

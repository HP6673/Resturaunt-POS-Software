import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import type { SessionPayload, StaffRole } from "@/lib/types";

export async function requireRole(
  roles: StaffRole[],
): Promise<{ session: SessionPayload } | { error: NextResponse }> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  if (!roles.includes(session.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

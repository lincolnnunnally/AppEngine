import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AppShell from "@/components/engine/app-shell";
import { canAccessEngineAdmin, canAccessEngineConsumerSurface } from "@/lib/auth/access";

// Cockpit route group. The (cockpit) segment is not part of any URL — it only
// scopes this layout, whose children render inside the AppShell rail. The entry
// two-door + consumer intakes live here; operator pages re-gate themselves below
// the layout. Access is the staged consumer-surface gate (default owner-only), so
// non-owner customers reach this shell only once Lincoln opens the doors.
export const dynamic = "force-dynamic";

export default async function CockpitLayout({ children }: { children: ReactNode }) {
  if (!(await canAccessEngineConsumerSurface())) {
    redirect("/soft-launch");
  }

  // Operators see the full rail; customers see a trimmed consumer rail with no
  // operator jargon. Operator pages stay protected by their own gates regardless.
  const isOperator = await canAccessEngineAdmin();

  return <AppShell isOperator={isOperator}>{children}</AppShell>;
}

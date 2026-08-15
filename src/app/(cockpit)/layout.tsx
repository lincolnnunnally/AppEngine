import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AppShell from "@/components/engine/app-shell";
import { canAccessEngineAdmin, canAccessEngineConsumerSurface } from "@/lib/auth/access";
import { isDashboardRequest } from "@/lib/auth/hosts";

// Cockpit route group. The (cockpit) segment is not part of any URL — it only
// scopes this layout, whose children render inside the AppShell rail.
// dashboard.unitedundergod.org is owner-only. The factory host keeps the
// staged consumer-surface gate.
export const dynamic = "force-dynamic";

export default async function CockpitLayout({ children }: { children: ReactNode }) {
  if (await isDashboardRequest()) {
    if (!(await canAccessEngineAdmin())) {
      redirect("/signin");
    }
    return <AppShell isOperator>{children}</AppShell>;
  }

  if (!(await canAccessEngineConsumerSurface())) {
    redirect("/soft-launch");
  }

  // Factory host stays customer-focused even if the owner is signed in.
  return <AppShell isOperator={false}>{children}</AppShell>;
}

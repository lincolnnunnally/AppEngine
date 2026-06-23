import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AppShell from "@/components/engine/app-shell";
import { canAccessEngineOwner } from "@/lib/auth/access";

// Operator route group. The (cockpit) segment is not part of any URL — it only
// scopes this layout to operator pages, which render inside the AppShell rail.
// Public pages live outside this group and keep the minimal root layout untouched.
export const dynamic = "force-dynamic";

export default async function CockpitLayout({ children }: { children: ReactNode }) {
  if (!(await canAccessEngineOwner())) {
    redirect("/soft-launch");
  }

  return <AppShell>{children}</AppShell>;
}

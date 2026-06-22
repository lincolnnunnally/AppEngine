import type { ReactNode } from "react";
import AppShell from "@/components/engine/app-shell";

// Operator route group. The (cockpit) segment is not part of any URL — it only
// scopes this layout to operator pages, which render inside the AppShell rail.
// Public pages (problem-intake-lite, spark-of-hope-intake-lite, account) live
// outside this group and keep the minimal root layout untouched.
export default function CockpitLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

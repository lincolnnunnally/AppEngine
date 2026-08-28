import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Bare /apps is the same glance as the desk home. Dossiers live at /apps/[slug]. */
export default function AppsIndexPage() {
  redirect("/");
}

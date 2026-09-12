import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// One public factory home at "/". Keep this route so old bookmarks and the
// consumer-surface gate still have a place to land.
export default function SoftLaunchPage() {
  redirect("/");
}

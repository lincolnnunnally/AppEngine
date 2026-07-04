import { redirect } from "next/navigation";

// Consolidated into /integrations — the single home for every secret and
// variable (We Succeed's own keys, a custom-variable row, and a per-app section
// for every other app). This page used to be a separate per-app credential map;
// its job now lives on /integrations, so it forwards there.
export const dynamic = "force-dynamic";

export default function CredentialsPage() {
  redirect("/integrations");
}

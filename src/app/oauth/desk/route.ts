import { NextResponse } from "next/server";
import { signIn } from "@/auth";
import { hasGithubProvider } from "@/lib/auth/access";
import { DASHBOARD_ORIGIN } from "@/lib/auth/hosts";

export const dynamic = "force-dynamic";

// Factory-only GitHub start for the private desk. Route handlers may set
// cookies; a page render cannot. GitHub's OAuth app callbacks here, then
// Auth.js returns the owner to dashboard.unitedundergod.org.
export async function GET() {
  if (!hasGithubProvider()) {
    return NextResponse.redirect(`${DASHBOARD_ORIGIN}/signin?error=Configuration`);
  }

  await signIn("github", { redirectTo: `${DASHBOARD_ORIGIN}/` });
}

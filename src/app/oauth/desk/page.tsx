import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { DASHBOARD_ORIGIN, FACTORY_ORIGIN, isDashboardRequest } from "@/lib/auth/hosts";
import { hasGithubProvider } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

// Factory-only GitHub start for the private desk. GitHub's OAuth app
// callbacks on appengine.unitedundergod.org; this page issues PKCE on that
// host, then Auth.js sends the owner back to dashboard.unitedundergod.org.
export default async function DeskGithubStart() {
  if (await isDashboardRequest()) {
    redirect(`${FACTORY_ORIGIN}/oauth/desk`);
  }

  if (!hasGithubProvider()) {
    redirect("/signin?error=Configuration");
  }

  await signIn("github", { redirectTo: `${DASHBOARD_ORIGIN}/` });
}

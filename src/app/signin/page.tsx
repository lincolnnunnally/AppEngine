import { headers } from "next/headers";
import { signIn } from "@/auth";
import { hasEmailSignIn, hasGithubProvider, hasGoogleProvider } from "@/lib/auth/access";
import { DASHBOARD_ORIGIN, hostFromHeader, isDashboardHostName, isDashboardRequest } from "@/lib/auth/hosts";

async function afterSignIn(): Promise<string> {
  const host = hostFromHeader((await headers()).get("host"));
  return isDashboardHostName(host) ? `${DASHBOARD_ORIGIN}/` : "/";
}

// Public, branded sign-in. Consumer-friendly options first (Google, email link);
// GitHub is a quiet secondary option. Each renders only when its provider is
// configured, so the page stays correct as providers are turned on. No mention of
// GitHub/infra unless that's the only option available.
export const dynamic = "force-dynamic";

// Auth.js redirects every failure back here as /signin?error=<code>. Silent
// failures read as "login is broken", so each code gets a human sentence.
const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "We couldn't start the sign-in. Please try again.",
  OAuthCallback: "The sign-in provider didn't complete. Please try again.",
  OAuthAccountNotLinked: "This email is already linked to a different sign-in method. Use the option you signed up with.",
  AccessDenied: "Sign-in was cancelled or not permitted for this account.",
  Verification: "That sign-in link expired or was already used. Request a fresh one.",
  MissingCSRF: "Your session expired mid-sign-in. Please try again.",
  Configuration: "Sign-in isn't configured correctly right now. Please try again shortly.",
  Default: "Something went wrong signing you in. Please try again."
};

function errorMessage(code?: string | string[]) {
  if (!code) {
    return null;
  }

  const single = Array.isArray(code) ? code[0] : code;

  return ERROR_MESSAGES[single] || ERROR_MESSAGES.Default;
}

export default async function SignInPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string | string[] }>;
}) {
  const google = hasGoogleProvider();
  const email = hasEmailSignIn();
  const github = hasGithubProvider();
  const consumerOption = google || email;
  const params = searchParams ? await searchParams : undefined;
  const error = errorMessage(params?.error);
  const desk = await isDashboardRequest();

  return (
    <main className={desk ? "desk-auth" : "soft-launch"}>
      {desk ? <div className="desk-auth-glow" aria-hidden="true" /> : null}
      <section className={desk ? "desk-auth-card" : "soft-launch-panel"}>
        {desk ? (
          <>
            <div className="desk-auth-brand">
              <span className="desk-mark" aria-hidden="true">
                U
              </span>
              <span>
                United Under God
                <small>the businesses</small>
              </span>
            </div>
            <p className="desk-auth-kicker">Private desk</p>
            <h1>Welcome back</h1>
            <p>Sign in with the owner account to see money, people, and who needs a hand.</p>
          </>
        ) : (
          <>
            <p className="soft-launch-kicker">AppEngine — app builder</p>
            <h1>Sign in to start</h1>
            <p>Describe a problem you want solved or a tool you want to build, and we&apos;ll build you a real, working app. Sign in to begin.</p>
          </>
        )}

        {error ? (
          <p className="signin-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="signin-options">
          {google ? (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: await afterSignIn() });
              }}
            >
              <button className={desk ? "desk-btn desk-btn-primary signin-full" : "soft-launch-action signin-full"} type="submit">
                Continue with Google
              </button>
            </form>
          ) : null}

          {email ? (
            <form
              className="signin-email"
              action={async (formData: FormData) => {
                "use server";
                const address = String(formData.get("email") || "").trim();
                await signIn("resend", { email: address, redirectTo: await afterSignIn() });
              }}
            >
              <label className="signin-label" htmlFor="signin-email">
                {desk ? "Email a sign-in link" : "Or enter your email — we'll send you a sign-in link"}
              </label>
              <input
                id="signin-email"
                className={desk ? "desk-input" : "convo-input signin-input"}
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                autoComplete="email"
              />
              <button className={desk ? "desk-btn desk-btn-primary signin-full" : "soft-launch-action signin-full"} type="submit">
                Email me a sign-in link
              </button>
            </form>
          ) : null}

          {github ? (
            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo: await afterSignIn() });
              }}
            >
              <button className={desk || consumerOption ? "signin-secondary" : "soft-launch-action signin-full"} type="submit">
                Sign in with GitHub
              </button>
            </form>
          ) : null}

          {!google && !email && !github ? (
            <p className="signin-none">Sign-in isn&apos;t set up yet. Please check back soon.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

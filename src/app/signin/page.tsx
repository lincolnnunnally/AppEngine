import { signIn } from "@/auth";
import { hasEmailSignIn, hasGithubProvider, hasGoogleProvider } from "@/lib/auth/access";

// Public, branded sign-in. Consumer-friendly options first (Google, email link);
// GitHub is a quiet secondary option. Each renders only when its provider is
// configured, so the page stays correct as providers are turned on. No mention of
// GitHub/infra unless that's the only option available.
export const dynamic = "force-dynamic";

export default function SignInPage() {
  const google = hasGoogleProvider();
  const email = hasEmailSignIn();
  const github = hasGithubProvider();
  const consumerOption = google || email;

  return (
    <main className="soft-launch">
      <section className="soft-launch-panel">
        <p className="soft-launch-kicker">We Succeed — app builder</p>
        <h1>Sign in to start</h1>
        <p>Describe a problem you want solved or a tool you want to build, and we&apos;ll build you a real, working app. Sign in to begin — no setup needed.</p>

        <div className="signin-options">
          {google ? (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/" });
              }}
            >
              <button className="soft-launch-action signin-full" type="submit">
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
                await signIn("resend", { email: address, redirectTo: "/" });
              }}
            >
              <label className="signin-label" htmlFor="signin-email">
                Or enter your email — we&apos;ll send you a sign-in link
              </label>
              <input
                id="signin-email"
                className="convo-input signin-input"
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                autoComplete="email"
              />
              <button className="soft-launch-action signin-full" type="submit">
                Email me a sign-in link
              </button>
            </form>
          ) : null}

          {github ? (
            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo: "/" });
              }}
            >
              <button className={consumerOption ? "signin-secondary" : "soft-launch-action signin-full"} type="submit">
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

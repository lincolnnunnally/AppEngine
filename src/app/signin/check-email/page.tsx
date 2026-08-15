import { isDashboardRequest } from "@/lib/auth/hosts";

export const dynamic = "force-dynamic";

export default async function CheckEmailPage() {
  const desk = await isDashboardRequest();

  return (
    <main className={desk ? "desk-auth" : "soft-launch"}>
      {desk ? <div className="desk-auth-glow" aria-hidden="true" /> : null}
      <section className={desk ? "desk-auth-card" : "soft-launch-panel"}>
        {desk ? (
          <div className="desk-auth-brand">
            <span className="desk-mark" aria-hidden="true">
              U
            </span>
            <span>
              United Under God
              <small>the businesses</small>
            </span>
          </div>
        ) : (
          <p className="soft-launch-kicker">AppEngine — app builder</p>
        )}
        <h1>Check your email</h1>
        <p>
          We sent a sign-in link. It stays on this site — open it on this device and you&apos;ll land back here. The
          link works once and expires if you wait too long.
        </p>
        <a className={desk ? "desk-btn desk-btn-primary" : "soft-launch-action"} href="/signin">
          Use a different email
        </a>
      </section>
    </main>
  );
}

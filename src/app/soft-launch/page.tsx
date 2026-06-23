import Link from "next/link";

export const dynamic = "force-dynamic";

export default function SoftLaunchPage() {
  return (
    <main className="soft-launch">
      <section className="soft-launch-panel">
        <p className="soft-launch-kicker">we-succeed.org</p>
        <h1>Owner-only soft launch</h1>
        <p>
          Opportunity is in a controlled preview right now. Lincoln can sign in to review the two-door entry point and
          run the app privately before public access opens.
        </p>
        <Link className="soft-launch-action" href="/api/auth/signin?callbackUrl=%2F">
          Owner sign in
        </Link>
      </section>
    </main>
  );
}

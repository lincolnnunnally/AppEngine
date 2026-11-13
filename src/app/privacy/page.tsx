import Link from "next/link";
import { LegalPage, PRIVACY_EMAIL } from "@/components/legal/legal-page";

export const metadata = {
  title: "Privacy Policy",
  description: "What App Engine collects, why, who helps us run it, and how to see or delete your information."
};

export default function PrivacyPage() {
  return (
    <LegalPage label="Privacy" title="Privacy Policy">
      <p>We treat your information the way we&apos;d want ours treated: carefully, only what we need, and never as a product.</p>
      <p className="note">We never sell your data. We don&apos;t advertise to you using it. App Engine uses no tracking or advertising cookies.</p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your email address, and your name if you sign in with Google. A sign-in cookie
          keeps you signed in.
        </li>
        <li>
          <strong>What you tell us:</strong> your description of the app you want, your answers to our questions, and
          messages you send for help.
        </li>
        <li>
          <strong>Your orders:</strong> what you bought and what you paid. Stripe handles the payment; we never see or
          store your card number.
        </li>
        <li>
          <strong>Your app&apos;s activity:</strong> how much storage and processing your app uses each month, so we can
          apply its free allowance. This is totals, not what&apos;s inside your app.
        </li>
      </ul>

      <h2>Information inside the app we build for you</h2>
      <p>
        Each app has its own database. What your app collects from the people who use it belongs to you. We don&apos;t
        sell it or use it for anything else. We only look at it when it&apos;s needed to keep your app running, or to fix
        a problem you&apos;ve asked us to fix.
      </p>

      <h2>Who helps us run App Engine</h2>
      <p>These services handle information on our behalf, only to provide App Engine:</p>
      <ul>
        <li>Vercel — hosts App Engine and the apps we build</li>
        <li>Neon — the database for each app we build</li>
        <li>Stripe — payments</li>
        <li>Resend — email (sign-in links, receipts, and notices about your app)</li>
        <li>Google — only if you choose to sign in with Google</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and orders while you have an account, and payment records as long as the law requires. If
        you close your account, we delete the rest.
      </p>

      <h2>Your choices</h2>
      <p>
        Email <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> to see, correct or delete your information, or to
        close your account. We&apos;ll reply within 30 days.
      </p>
      <p>
        See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}

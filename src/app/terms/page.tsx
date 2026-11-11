import Link from "next/link";
import { LegalPage, SUPPORT_EMAIL } from "@/components/legal/legal-page";

export const metadata = {
  title: "Terms of Service",
  description: "The terms for using App Engine to build an app at a flat price."
};

export default function TermsPage() {
  return (
    <LegalPage label="Terms" title="Terms of Service">
      <p>
        We tried to write these in plain language. By creating an account or paying for a build, you agree to what&apos;s
        below. In these terms, &quot;App Engine,&quot; &quot;we,&quot; and &quot;us&quot; mean the operator of the App
        Engine service at appengine.unitedundergod.org. &quot;You&quot; means the person or organization using it.
      </p>

      <h2>What App Engine does</h2>
      <p>
        You describe what you need. We put your app together from pieces we already keep and have tested, show you the
        price, and once you pay, build it and publish it at its own web address. The first version is a working starter
        that we keep improving with you.
      </p>

      <h2>Price and payment</h2>
      <ul>
        <li>The price you see before you pay is the price you pay for the build — once.</li>
        <li>Payments are handled by Stripe. We never see or store your card number.</li>
        <li>Refunds work as described on our <Link href="/refunds">Refunds</Link> page.</li>
      </ul>

      <h2>Hosting</h2>
      <ul>
        <li>We host the app we build for you. Hosting is free while your app stays inside its monthly allowance.</li>
        <li>
          If a busy app goes past the allowance, the extra activity is charged at what it costs us plus a small margin,
          from prepaid credits. We email you when your app reaches 80% and 100% of its allowance.
        </li>
        <li>We don&apos;t switch an app off for being busy.</li>
      </ul>

      <h2>If a build doesn&apos;t work</h2>
      <p>
        If a build fails or your app doesn&apos;t do what you paid for, we rebuild or fix it at no extra charge. Tell us
        through the <Link href="/help">help form</Link>.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 18 (or the age of majority where you live).</li>
        <li>If you sign up for a church, business or other organization, you must be allowed to accept these terms for it.</li>
        <li>Keep your sign-in safe. You&apos;re responsible for what happens under your account.</li>
      </ul>

      <h2>Your app and your content</h2>
      <ul>
        <li>What you put into your app — your words, pictures, and the information your app collects — is yours.</li>
        <li>
          You give us permission to store, copy and display it only as needed to build, host, fix and support your app.
        </li>
        <li>
          You&apos;re responsible for how you use your app and for the information it collects about other people. If it
          collects personal information, tell the people using it how you&apos;ll use it.
        </li>
      </ul>

      <h2>What you can&apos;t use App Engine for</h2>
      <ul>
        <li>Anything illegal, or anything that harms, deceives or harasses people.</li>
        <li>Collecting passwords or payment details under false pretenses, or pretending to be someone you&apos;re not.</li>
        <li>Spam, malware, or attempts to break into our systems or anyone else&apos;s.</li>
      </ul>
      <p>We may take down an app that breaks these rules. We&apos;ll tell you why unless the law or someone&apos;s safety prevents it.</p>

      <h2>What we can and can&apos;t promise</h2>
      <p>
        We work hard to keep your app running and correct. Like any online service, it may sometimes be unavailable or
        have mistakes, and we can&apos;t promise it never will. To the extent the law allows, our responsibility to you
        for any claim is limited to the amount you paid us for the build in question.
      </p>

      <h2>Changes</h2>
      <p>
        If we change these terms, we&apos;ll update the date at the top. For a change that matters to customers, we&apos;ll
        also email you before it takes effect.
      </p>

      <h2>Contact us</h2>
      <p>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or the <Link href="/help">help form</Link>. See also our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}

import Link from "next/link";
import { LegalPage, SUPPORT_EMAIL } from "@/components/legal/legal-page";

export const metadata = {
  title: "Refunds",
  description: "You see and approve the price before you pay. If your app doesn't work, we fix it at no charge."
};

export default function RefundsPage() {
  return (
    <LegalPage label="Refunds" title="If something isn't right">
      <p>
        App Engine builds at a flat price. You see the full price before you pay, and you approve it. There is no meter
        running and no surprise bill for the build.
      </p>
      <h2>Because you approve the price first, we don&apos;t offer routine refunds</h2>
      <p>
        Paying means you&apos;ve seen and agreed to what you&apos;re buying and what it costs. Changing your mind after
        the build has started is not, on its own, a reason for a refund.
      </p>
      <h2>If your app doesn&apos;t work, we fix it — at no charge</h2>
      <p>
        If a build fails, or the app we deliver doesn&apos;t do the job you paid for, tell us. We&apos;ll rebuild it or
        correct what&apos;s wrong until it works, and you won&apos;t be charged again for that.
      </p>
      <h2>If we still can&apos;t make it right</h2>
      <p>
        If we&apos;ve tried and still can&apos;t get your app working, and we can&apos;t make it right for you, contact
        us. We&apos;ll look at your case and may offer a refund. Those decisions are made one case at a time.
      </p>
      <h2>Hosting and usage charges</h2>
      <p>
        Hosting is free while your app stays inside its monthly allowance. If a busy app goes past it, the extra activity
        is charged from your prepaid credits, and we tell you before that happens. If you think a usage charge is wrong,
        tell us and we&apos;ll check the numbers with you.
      </p>
      <h2>How to ask</h2>
      <p>
        Use the <Link href="/help">help form</Link> (choose the app you built) or email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. A real person reads every message.
      </p>
      <p className="note">Nothing here limits any rights you have under the law where you live.</p>
    </LegalPage>
  );
}

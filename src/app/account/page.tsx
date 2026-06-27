import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccessEngineCustomerArea } from "@/lib/auth/access";
import { getBalanceCents, getBillingConfig, isBillingEnabled, normalizeUserKey } from "@/lib/engine/billing";
import { BuyCredits } from "@/components/billing/buy-credits";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!(await canAccessEngineCustomerArea())) {
    redirect("/");
  }

  // Credits section appears only when billing is turned on + configured.
  const billingOn = isBillingEnabled();
  let balanceLabel: string | null = null;
  if (billingOn) {
    const session = await auth();
    const userKey = normalizeUserKey(session?.user?.email);
    if (userKey) {
      try {
        balanceLabel = `$${(await getBalanceCents(userKey) / 100).toFixed(2)}`;
      } catch {
        balanceLabel = null;
      }
    }
  }
  const config = getBillingConfig();

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Customer</p>
        <h1>Customer Account</h1>
        <p>
          This protected area will let customers manage their organization,
          subscription, requests, generated apps, notifications, files, and
          support activity.
        </p>
      </section>

      {billingOn ? (
        <section className="panel">
          <p className="eyebrow">Credits</p>
          <h2>{balanceLabel ?? "$0.00"} available</h2>
          <p>Each app build uses credits. Add more any time — you only pay for what you build.</p>
          <BuyCredits packsCents={config.packsCents} />
        </section>
      ) : null}

      <section className="grid" style={{ marginTop: 16 }}>
        {["Profile", "Organization", "Plan", "Requests", "Notifications", "Support"].map((item) => (
          <article className="card" key={item}>
            <p className="eyebrow">Account Module</p>
            <h3>{item}</h3>
            <p>Template placeholder ready for implementation and Neon persistence.</p>
          </article>
        ))}
      </section>
    </main>
  );
}

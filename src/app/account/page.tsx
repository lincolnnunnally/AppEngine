import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccessCustomerArea } from "@/lib/auth/roles";

export default async function AccountPage() {
  const session = await auth();

  if (!canAccessCustomerArea(session?.user?.role)) {
    redirect("/");
  }

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

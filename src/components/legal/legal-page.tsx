import Link from "next/link";

// Shared frame for App Engine's public policy pages (/terms, /privacy, /refunds).
// Plain language on purpose: a customer should understand what they agreed to.
export const LEGAL_UPDATED = "November 2026";
export const SUPPORT_EMAIL = "support@unitedundergod.org";
export const PRIVACY_EMAIL = "privacy@unitedundergod.org";

export function LegalPage({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <main className="shell help-shell">
      <section className="panel legal">
        <p className="dx-label">{label}</p>
        <h1 className="dx-display">{title}</h1>
        <p className="note">Last updated: {LEGAL_UPDATED}</p>
        {children}
        <p className="legal-links">
          <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/refunds">Refunds</Link> ·{" "}
          <Link href="/help">Get help</Link>
        </p>
      </section>
    </main>
  );
}

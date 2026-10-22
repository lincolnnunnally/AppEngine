// Customers by product — COUNTS from the shared LPL Supabase, one line per
// product the owner sells. Every filter below was read in that product's own
// code, never guessed (cited per row). A table or filter that errors is null
// ("not reporting"), never zero. No PII: every read is a count. SERVER ONLY.
import { countRows, lplOpsConfigured } from "@/lib/engine/lpl-ops-stats";

export type CustomerCount = {
  label: string;
  value: number | null; // null = not reporting (table missing, filter refused, or not connected)
  basis: string; // what the number means, in plain words
};

export type CustomerProduct = {
  product: string;
  slug: string | null; // /apps/<slug> dossier when the app is in the portfolio
  connected: boolean;
  counts: CustomerCount[];
  note?: string;
};

export async function loadCustomerCounts(): Promise<CustomerProduct[]> {
  const connected = lplOpsConfigured();
  const count = (table: string, query: string) => (connected ? countRows(table, query) : Promise.resolve(null));

  const [awdPublished, awdPaid, epClients, epSubs, epLive, ccCustomers] = await Promise.all([
    // ai-website-design src/app/api/admin/stats/route.ts — status=eq.published
    count("awd_sites", "select=id&status=eq.published"),
    // ai-website-design src/lib/entitlement.ts — setup paid + active/trialing/past_due
    count("awd_subscriptions", "select=id&setup_paid=eq.true&status=in.(active,trialing,past_due)"),
    // easypeazy backend/supabase_db.py — "clients" -> ep_clients
    count("ep_clients", "select=id"),
    // easypeazy backend/server.py admin stats — subscriptions {"status": "active"}
    count("ep_subscriptions", "select=id&status=eq.active"),
    // easypeazy backend/server.py build pipeline — a site whose address answers is status "active"
    count("ep_websites", "select=id&status=eq.active"),
    // churchconnect backend/routes/public_submission.py — churches {"is_customer": True}
    // (cc_* rows are JSONB documents via db_compat, so the field lives in doc)
    count("cc_churches", "select=id&doc->>is_customer=eq.true")
  ]);

  return [
    {
      product: "AI Website Design",
      slug: "ai-website-design",
      connected,
      counts: [
        { label: "Live websites", value: awdPublished, basis: "sites published to the public" },
        { label: "Paid plans", value: awdPaid, basis: "setup paid, plan active / trialing / past due" }
      ]
    },
    {
      product: "Easy Peazy",
      slug: "easy-peasy-website",
      connected,
      counts: [
        { label: "Clients", value: epClients, basis: "every client account" },
        { label: "Active plans", value: epSubs, basis: "subscriptions marked active" },
        { label: "Live websites", value: epLive, basis: "built and answering at their address" }
      ]
    },
    {
      product: "ChurchConnect",
      slug: "churchconnect",
      connected,
      counts: [{ label: "Customer churches", value: ccCustomers, basis: "churches marked as customers" }]
    },
    {
      product: "Operate",
      slug: null,
      connected: false,
      counts: [],
      note: "Not connected — Operate keeps its own database, so its customers do not show here yet."
    }
  ];
}

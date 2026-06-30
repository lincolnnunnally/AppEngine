// Buy a custom domain through Spaceship and attach it to the customer's app.
// Paid: the domain's cost + margin is deducted from the customer's credit wallet,
// and a purchase only happens with EXPLICIT confirmation. Money-correct ordering:
// charge first (idempotent per domain) -> register -> REFUND if registration fails
// -> attach. SERVER ONLY. Dormant until Spaceship + billing are configured.
import { chargeForDomain, creditAccount, getBalanceCents, getBillingConfig, isBillingEnabled } from "@/lib/engine/billing";
import { attachDomainToVercelProject } from "@/lib/engine/domains";

const SPACESHIP_API = "https://spaceship.dev/api/v1";

export function spaceshipConfigured() {
  return Boolean(process.env.SPACESHIP_API_KEY && process.env.SPACESHIP_API_SECRET && process.env.SPACESHIP_CONTACT_ID);
}

export function domainPurchaseEnabled() {
  return isBillingEnabled() && spaceshipConfigured();
}

async function spaceship(path: string, init?: RequestInit) {
  return fetch(`${SPACESHIP_API}${path}`, {
    ...init,
    headers: {
      "X-API-Key": process.env.SPACESHIP_API_KEY || "",
      "X-API-Secret": process.env.SPACESHIP_API_SECRET || "",
      "content-type": "application/json",
      ...(init?.headers || {})
    }
  });
}

export type DomainQuote = { domain: string; available: boolean; costCents: number; chargeCents: number };

// Spaceship availability + price, plus the price we'd charge (cost + margin).
export async function quoteDomain(domain: string): Promise<DomainQuote> {
  const clean = domain.trim().toLowerCase();
  const { marginMultiplier } = getBillingConfig();
  try {
    const response = await spaceship(`/domains/${encodeURIComponent(clean)}/available`);
    const data = (await response.json().catch(() => ({}))) as {
      result?: string;
      premiumPricing?: Array<{ operation?: string; price?: number }>;
    };
    const available = String(data.result ?? "").toLowerCase() === "available";
    const register = (data.premiumPricing || []).find((p) => /register|create/i.test(p.operation ?? "")) || data.premiumPricing?.[0];
    const costCents = Math.round((Number(register?.price) || 0) * 100);
    return { domain: clean, available, costCents, chargeCents: Math.max(1, Math.ceil(costCents * marginMultiplier)) };
  } catch {
    return { domain: clean, available: false, costCents: 0, chargeCents: 0 };
  }
}

export type PurchaseResult = { ok: boolean; message: string; domain?: string; chargedCents?: number };

export async function purchaseDomainForCustomer(
  userKey: string,
  domain: string,
  projectName: string,
  confirm: boolean
): Promise<PurchaseResult> {
  if (!confirm) {
    return { ok: false, message: "A domain purchase needs explicit confirmation." };
  }
  if (!domainPurchaseEnabled()) {
    return { ok: false, message: "Domain purchasing isn't enabled yet." };
  }

  const quote = await quoteDomain(domain);
  if (!quote.available || quote.costCents <= 0) {
    return { ok: false, message: "That domain isn't available to buy." };
  }

  const balance = await getBalanceCents(userKey);
  if (balance < quote.chargeCents) {
    return { ok: false, message: `Not enough credits — this domain needs $${(quote.chargeCents / 100).toFixed(2)}.` };
  }

  // Charge first (idempotent per domain), then register; refund if registration fails.
  await chargeForDomain(userKey, quote.domain, quote.chargeCents);

  const contactId = process.env.SPACESHIP_CONTACT_ID || "";
  try {
    const register = await spaceship(`/domains/${encodeURIComponent(quote.domain)}`, {
      method: "POST",
      body: JSON.stringify({
        autoRenew: false,
        years: 1,
        privacyProtection: { level: "high", userConsent: true },
        contacts: { registrant: contactId, admin: contactId, tech: contactId, billing: contactId }
      })
    });
    if (!register.ok && register.status !== 202) {
      await creditAccount(userKey, quote.chargeCents, `refund:domain:${quote.domain}`, "Domain registration failed — refund");
      return { ok: false, message: `Couldn't register the domain (${register.status}) — your credits were refunded.` };
    }
  } catch {
    await creditAccount(userKey, quote.chargeCents, `refund:domain:${quote.domain}`, "Domain registration error — refund");
    return { ok: false, message: "Domain registration failed — your credits were refunded." };
  }

  // Attach it to the app's Vercel project (DNS auto-configures via Spaceship later).
  await attachDomainToVercelProject(projectName, quote.domain).catch(() => {});

  return { ok: true, message: `${quote.domain} purchased and attached to your app.`, domain: quote.domain, chargedCents: quote.chargeCents };
}

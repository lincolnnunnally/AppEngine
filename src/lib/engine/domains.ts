// Custom domains for built apps. Availability + pricing reuse the proven Porkbun
// logic mined from the Easy Peasy domain module (catalog: Website Builder + Domains);
// attach uses the Vercel domains API. PURCHASE (registering a domain) costs money
// and is NEVER done automatically — it needs Porkbun credentials + the owner's
// explicit confirmation, and is built as a gated follow-up. SERVER ONLY.

// Per-TLD annual prices (USD), from the Easy Peasy module. Used for the mock path
// and as a fallback; the live Porkbun call returns the real price when available.
const DOMAIN_PRICING: Record<string, number> = {
  ".com": 10.93, ".net": 14.15, ".org": 12.79, ".io": 39.0, ".co": 32.98, ".app": 16.98,
  ".dev": 14.98, ".ai": 99.0, ".tech": 54.98, ".shop": 34.98, ".xyz": 12.98, ".online": 39.98,
  ".site": 29.98, ".store": 54.98, ".us": 10.48, ".info": 19.98, ".biz": 19.98, ".pro": 19.98,
  ".me": 24.98, ".tv": 39.98, ".cc": 19.98, ".org.uk": 9.98, ".co.uk": 9.98
};

export type DomainCheck = { domain: string; available: boolean; priceUsd: number; mock: boolean };

export function hasPorkbun() {
  return Boolean(process.env.PORKBUN_API_KEY && process.env.PORKBUN_SECRET_KEY);
}

function priceFor(domain: string): number {
  const ext = domain.slice(domain.lastIndexOf("."));
  return DOMAIN_PRICING[ext] ?? 14.99;
}

function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9.-]/g, "");
}

export async function checkDomainAvailability(input: string): Promise<DomainCheck> {
  const domain = normalizeDomain(input);
  if (!domain.includes(".")) {
    return { domain, available: false, priceUsd: priceFor(domain), mock: true };
  }

  if (!hasPorkbun()) {
    // Mock path (same heuristic as the Easy Peasy module) until creds are set.
    const commonTaken = ["google", "facebook", "amazon", "apple", "microsoft"];
    const base = domain.split(".")[0];
    return { domain, available: !commonTaken.includes(base), priceUsd: priceFor(domain), mock: true };
  }

  try {
    const response = await fetch(`https://api.porkbun.com/api/json/v3/domain/checkDomain/${encodeURIComponent(domain)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apikey: process.env.PORKBUN_API_KEY, secretapikey: process.env.PORKBUN_SECRET_KEY })
    });
    const data = (await response.json().catch(() => ({}))) as { response?: { avail?: string; price?: string | number } };
    const avail = String(data.response?.avail ?? "").toLowerCase() === "yes";
    const priceUsd = Number(data.response?.price) || priceFor(domain);
    return { domain, available: avail, priceUsd, mock: false };
  } catch {
    return { domain, available: false, priceUsd: priceFor(domain), mock: true };
  }
}

export type AttachResult = { ok: boolean; message: string; verification?: unknown };

// Attaches a domain the customer already owns to their app's Vercel project. They
// then point DNS to Vercel to finish. (Buying a new domain is the gated purchase flow.)
export async function attachDomainToVercelProject(projectName: string, input: string): Promise<AttachResult> {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    return { ok: false, message: "Hosting API isn't configured." };
  }
  const domain = normalizeDomain(input);
  try {
    const response = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectName)}/domains`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ name: domain })
    });
    const data = (await response.json().catch(() => ({}))) as { error?: { message?: string }; verification?: unknown };
    if (!response.ok) {
      return { ok: false, message: data.error?.message || `Couldn't attach the domain (${response.status}).` };
    }
    return { ok: true, message: `${domain} is attached — point its DNS to Vercel to finish.`, verification: data.verification };
  } catch {
    return { ok: false, message: "Couldn't reach the hosting API." };
  }
}

// Minimal Stripe client over the REST API (no SDK dependency — consistent with
// how this codebase calls OpenAI/Vercel). SERVER ONLY: uses STRIPE_SECRET_KEY.
import crypto from "node:crypto";

const STRIPE_API = "https://api.stripe.com";

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// Flatten nested objects/arrays into Stripe's form-encoded bracket notation.
function toForm(params: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [rawKey, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const key = prefix ? `${prefix}[${rawKey}]` : rawKey;
    if (typeof value === "object") {
      parts.push(toForm(value as Record<string, unknown>, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}

export async function stripeRequest<T = Record<string, unknown>>(path: string, params: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: toForm(params)
  });
  const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(data?.error?.message || `Stripe request failed (${response.status})`);
  }
  return data as T;
}

// Read-only GET (balance, charges, sessions) for the Reports page. `apiKey`
// overrides process.env so the owner's vault-stored key can be used server-side
// without ever entering the engine's env. A 403 means the restricted key lacks
// read permission on that resource — callers surface that honestly.
export async function stripeGet<T = Record<string, unknown>>(pathAndQuery: string, apiKey?: string): Promise<T> {
  const key = (apiKey || process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) throw new Error("No Stripe key available.");
  const response = await fetch(`${STRIPE_API}${pathAndQuery}`, {
    headers: { authorization: `Bearer ${key}` }
  });
  const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(data?.error?.message || `Stripe request failed (${response.status})`);
  }
  return data as T;
}

// Verify a Stripe webhook signature header ("t=…,v1=…") against the raw body.
// Returns true only for a valid, recent signature. Fail-closed on anything odd.
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!signatureHeader || !secret) return false;

  const fields: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const [k, v] = part.split("=");
    if (k && v) fields[k.trim()] = v.trim();
  }

  const timestamp = Number(fields.t);
  const provided = fields.v1;
  if (!Number.isFinite(timestamp) || !provided) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

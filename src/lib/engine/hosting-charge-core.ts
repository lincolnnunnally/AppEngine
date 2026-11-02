// Usage-based hosting for customer apps — the pure math. No fetch, no env, no
// `@/` imports, so `node --test` exercises the real module.
//
// Owner decision (Lincoln, 2026-11-01; LPL 03 §9a): no yearly fee. An app inside
// the free allowance is hosted free. A busy app pays only for the activity past
// the allowance, at our cost + the standard margin, drawn from App Engine
// credits. Nothing is switched off; out of credits = weekly reminder, and after
// 30 days unpaid it goes on Lincoln's to-do list (2026-11-02).

const MB = 1024 * 1024;
const GB = 1024 * MB;

// Free every month, per app. ~1 hour of use a day at the smallest database size.
// $0 to us on Neon's free plan; ≤ ~$1.06/month per app at paid rates.
export const FREE_ALLOWANCE = {
  computeHours: 10, // Neon CU-hours (compute size × hours awake)
  storageBytes: 500 * MB,
  transferBytes: 2 * GB
};

// What the activity costs us, list price, checked 2026-11-01 (neon.com/pricing,
// vercel.com/pricing). Cents. Update here when providers change prices.
export const HOSTING_RATES = {
  centsPerComputeHour: 10.6, // Neon Launch, per CU-hour
  centsPerStorageGbMonth: 35, // Neon Launch, per GB-month
  centsPerTransferGb: 15 // Vercel Pro data transfer past the included 1 TB (conservative)
};

export type MeasuredUsage = { computeHours: number; storageBytes: number; transferBytes: number };

export type OverageBreakdown = {
  computeHoursOver: number;
  storageGbOver: number;
  transferGbOver: number;
  costCents: number; // what the activity past the allowance costs us
  priceCents: number; // what the app's owner pays (cost × margin), whole cents
};

function over(value: number, allowance: number): number {
  return Math.max(0, (Number.isFinite(value) ? value : 0) - allowance);
}

/** Activity past the free allowance and its price. Inside the allowance → 0. */
export function overageFor(usage: MeasuredUsage, margin: number): OverageBreakdown {
  const computeHoursOver = over(usage.computeHours, FREE_ALLOWANCE.computeHours);
  const storageGbOver = over(usage.storageBytes, FREE_ALLOWANCE.storageBytes) / GB;
  const transferGbOver = over(usage.transferBytes, FREE_ALLOWANCE.transferBytes) / GB;
  const costCents =
    computeHoursOver * HOSTING_RATES.centsPerComputeHour +
    storageGbOver * HOSTING_RATES.centsPerStorageGbMonth +
    transferGbOver * HOSTING_RATES.centsPerTransferGb;
  const safeMargin = Number.isFinite(margin) && margin >= 1 ? margin : 1;
  // Round to whole cents; under half a cent is not worth a ledger line.
  const priceCents = Math.round(costCents * safeMargin);
  return { computeHoursOver, storageGbOver, transferGbOver, costCents, priceCents };
}

/** "2026-11" → "2026-10". */
export function previousPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return date.toISOString().slice(0, 7);
}

/** One charge per app per month, so a retry or a second sweep never double-charges. */
export function hostingChargeReference(jobId: string, period: string): string {
  return `hosting:${jobId}:${period}`;
}

export function dollars(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

export const REMINDER_EVERY_DAYS = 7;
export const ESCALATE_AFTER_DAYS = 30;

/**
 * What to do today about an owner whose credits are below zero.
 * - remind: weekly, starting the day they first go negative
 * - escalate: once, when unpaid for 30+ days (goes on Lincoln's to-do list)
 * Nothing here ever slows or stops the app.
 */
export function dunningStep(
  state: { firstUnpaidAt: string; lastRemindedAt: string | null; escalated: boolean },
  now: Date
): { remind: boolean; escalate: boolean; daysUnpaid: number } {
  const day = 24 * 60 * 60 * 1000;
  const daysUnpaid = Math.floor((now.getTime() - Date.parse(state.firstUnpaidAt)) / day);
  const sinceReminder = state.lastRemindedAt ? (now.getTime() - Date.parse(state.lastRemindedAt)) / day : Infinity;
  return {
    remind: sinceReminder >= REMINDER_EVERY_DAYS,
    escalate: !state.escalated && daysUnpaid >= ESCALATE_AFTER_DAYS,
    daysUnpaid
  };
}

// Pure math for paying customers and monthly recurring revenue — no fetch, no
// env, no `@/` imports, so `node --test` exercises the real module. Input is
// the active subscriptions Stripe lists; output is what the owner asks: how
// many people pay us every month, and how much that is.
//
// Honesty rules: MRR is list price × quantity, before coupons and tax. A price
// with no unit amount (tiered / metered) is NOT guessed — it is counted in
// `unpricedItems` and left out of the dollars. Non-USD lines are left out of
// the dollars and named in `otherCurrencies`.

export type StripeRecurring = {
  interval?: string | null; // day | week | month | year
  interval_count?: number | null;
};

export type StripeSubscriptionItem = {
  quantity?: number | null;
  price?: {
    unit_amount?: number | null;
    currency?: string | null;
    recurring?: StripeRecurring | null;
    product?: string | { id?: string; name?: string | null } | null;
  } | null;
};

export type StripeSubscription = {
  id?: string;
  customer?: string | { id?: string } | null;
  items?: { data?: StripeSubscriptionItem[] } | null;
};

export type RecurringProduct = {
  productId: string;
  name: string; // product name when known, else the product id
  subscriptions: number;
  customers: number;
  mrrCents: number;
};

export type RecurringFold = {
  payingCustomers: number;
  activeSubscriptions: number;
  mrrCents: number;
  unpricedItems: number;
  otherCurrencies: string[];
  products: RecurringProduct[]; // most MRR first
};

// One billing period's amount, as a monthly amount. A year is 12 months, a
// week is 52/12 of a month, a day is 365.25/12 of a month. Rounded to cents.
export function monthlyCents(amountCents: number, recurring: StripeRecurring | null | undefined): number | null {
  if (!Number.isFinite(amountCents)) return null;
  const count = Math.max(1, Math.floor(recurring?.interval_count ?? 1));
  const perMonth: Record<string, number> = {
    day: 365.25 / 12,
    week: 52 / 12,
    month: 1,
    year: 1 / 12
  };
  const factor = perMonth[recurring?.interval ?? ""];
  if (factor === undefined) return null;
  return Math.round((amountCents * factor) / count);
}

function idOf(value: string | { id?: string } | null | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.id || "";
}

export function summarizeSubscriptions(
  subscriptions: StripeSubscription[],
  productNames: Record<string, string> = {}
): RecurringFold {
  const customers = new Set<string>();
  const others = new Set<string>();
  const byProduct = new Map<string, RecurringProduct & { who: Set<string>; subs: Set<string> }>();
  let mrrCents = 0;
  let unpricedItems = 0;

  subscriptions.forEach((subscription, index) => {
    const customer = idOf(subscription.customer);
    if (customer) customers.add(customer);
    const subKey = subscription.id || `sub-${index}`;

    for (const item of subscription.items?.data ?? []) {
      const price = item.price ?? {};
      const productId = idOf(price.product) || "unknown";
      const expandedName = typeof price.product === "object" && price.product ? price.product.name : null;
      let product = byProduct.get(productId);
      if (!product) {
        product = {
          productId,
          name: expandedName || productNames[productId] || productId,
          subscriptions: 0,
          customers: 0,
          mrrCents: 0,
          who: new Set(),
          subs: new Set()
        };
        byProduct.set(productId, product);
      }
      product.subs.add(subKey);
      if (customer) product.who.add(customer);

      const currency = (price.currency ?? "usd").toLowerCase();
      if (currency !== "usd") {
        others.add(currency.toUpperCase());
        continue;
      }
      if (typeof price.unit_amount !== "number") {
        unpricedItems += 1;
        continue;
      }
      const quantity = typeof item.quantity === "number" && item.quantity >= 0 ? item.quantity : 1;
      const monthly = monthlyCents(price.unit_amount * quantity, price.recurring);
      if (monthly === null) {
        unpricedItems += 1;
        continue;
      }
      mrrCents += monthly;
      product.mrrCents += monthly;
    }
  });

  const products = [...byProduct.values()]
    .map(({ who, subs, ...product }) => ({ ...product, customers: who.size, subscriptions: subs.size }))
    .sort((a, b) => b.mrrCents - a.mrrCents || b.subscriptions - a.subscriptions || a.name.localeCompare(b.name));

  return {
    payingCustomers: customers.size,
    activeSubscriptions: subscriptions.length,
    mrrCents,
    unpricedItems,
    otherCurrencies: [...others].sort(),
    products
  };
}

// Marketplace: the owner lists an item on the shop page, a member finds it and
// orders it through checkout, and the owner sees the order — including who
// placed it — and moves it along; the member sees the new status. A fresh shop
// sells only what the owner listed (nothing a member could order by mistake).
//
// Then the store's money and pricing jobs (C12): an order turns paid only when
// Stripe's signed webhook confirms exactly its total, and only once; a customer
// on a price level, with their own price, or with a price agreed in an offer is
// charged that on the server; an agreed price sticks unless the owner makes it
// one-time; the owner's "goes well with" picks show on the product page.
import crypto from "node:crypto";
import { api, expectText } from "./_helpers.mjs";

// Signed test webhooks only (the harness passes this secret to the app). No
// STRIPE_SECRET_KEY is set, so nothing here reaches Stripe.
process.env.STRIPE_WEBHOOK_SECRET ||= "whsec_prove_only_signing_secret_0123456789";

function signed(payload) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

async function stripePaid(page, base, orderId, amountCents, signature) {
  const payload = JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { payment_status: "paid", amount_total: amountCents, customer_email: "buyer@example.com", metadata: { marketplace_order_id: orderId } } }
  });
  const res = await page.request.post(`${base}/api/billing/webhook`, {
    data: payload,
    headers: { "content-type": "application/json", "stripe-signature": signature ?? signed(payload) }
  });
  return res.status();
}

async function orderAs(member, base, productId, quantity) {
  const res = await api(member, "POST", `${base}/api/marketplace/orders`, { productId, quantity, fulfillmentType: "pickup" });
  return res.order;
}

export async function task({ page, base, newMember }) {
  const member = await newMember();
  await expectText(member, `${base}/marketplace`, "No products in the catalog yet", "a fresh shop offers nothing the owner did not list");

  // The owner lists an item from the shop page.
  await page.goto(`${base}/marketplace`, { waitUntil: "domcontentloaded" });
  await page.fill('main input[name="productName"]', "Prove Lantern");
  await page.fill('main textarea[name="productDescription"]', "Hand-made tin lantern.");
  await page.fill('main input[name="basePrice"]', "24.50");
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/marketplace/products") && r.request().method() === "POST"),
    page.click("main button:has-text('List this product')")
  ]);
  await expectText(page, `${base}/marketplace`, "Prove Lantern", "the owner sees the listed item");

  // The member finds it and orders it through checkout (local pickup).
  await expectText(member, `${base}/marketplace`, "Prove Lantern", "the member sees the listed item");
  await member.click("main a:has-text('Prove Lantern')");
  await member.waitForURL(/\/marketplace\/[0-9a-f-]{36}$/);
  await member.check('main input[type="radio"] >> nth=1');
  await member.fill('main input[aria-label="Quantity"]', "2");
  await Promise.all([
    member.waitForResponse((r) => r.url().endsWith("/api/marketplace/orders") && r.request().method() === "POST"),
    member.click("main button:has-text('Place order')")
  ]);
  await member.getByText("Order placed").waitFor({ timeout: 10000 });
  await expectText(member, `${base}/marketplace/orders`, "Prove Lantern", "the member sees their order");

  const mine = await api(member, "GET", `${base}/api/marketplace/orders`);
  const order = (mine.orders || []).find((o) => o.productName === "Prove Lantern");
  if (!order) throw new Error("the member's order is not in their list");
  if (order.quantity !== 2 || Math.abs(order.totalAmount - 49) > 0.001) throw new Error(`order priced ${order.quantity} × = $${order.totalAmount}, want 2 × $24.50 = $49.00`);
  if (order.status !== "pending") throw new Error(`a new order reads "${order.status}"`);

  // The owner sees the order and who to fulfil it for, and marks it paid.
  await expectText(page, `${base}/marketplace/orders`, order.orderNumber, "the owner sees the order");
  await expectText(page, `${base}/marketplace/orders/${order.id}`, member.email, "the owner sees who placed the order");
  await api(page, "PATCH", `${base}/api/marketplace/orders/${order.id}`, { status: "paid" });
  const after = await api(member, "GET", `${base}/api/marketplace/orders/${order.id}`);
  if (after.order?.status !== "paid") throw new Error(`the member sees status "${after.order?.status}" after the owner marked it paid`);

  // Roles: a member cannot list products or change an order; another member cannot read it.
  const list = await member.request.post(`${base}/api/marketplace/products`, { data: { name: "Member Item", basePrice: 1 } });
  if (list.status() !== 403) throw new Error(`a member listed a product (${list.status()})`);
  const self = await member.request.patch(`${base}/api/marketplace/orders/${order.id}`, { data: { status: "shipped" } });
  if (self.status() !== 403) throw new Error(`a member changed their order status (${self.status()})`);
  const other = await newMember();
  const peek = await other.request.get(`${base}/api/marketplace/orders/${order.id}`);
  if (peek.ok()) throw new Error("another member read this member's order");

  // ---- Paid only when Stripe confirms exactly the total ----------------------
  const unpaid = await orderAs(member, base, order.productId, 1);
  const payRes = await member.request.post(`${base}/api/marketplace/orders/${unpaid.id}/pay`);
  const payBody = await payRes.json().catch(() => ({}));
  if (payRes.status() !== 503 || !/isn't taking card payments/.test(payBody.message || "")) {
    throw new Error(`with no Stripe key, paying should say so plainly (got ${payRes.status()} ${payBody.message})`);
  }
  if ((await stripePaid(page, base, unpaid.id, 2450, "t=1,v1=forged")) !== 400) throw new Error("a forged Stripe event was accepted");
  await stripePaid(page, base, unpaid.id, 100);
  if ((await api(member, "GET", `${base}/api/marketplace/orders/${unpaid.id}`)).order.status !== "pending") throw new Error("a payment for the wrong amount marked the order paid");
  if ((await stripePaid(page, base, unpaid.id, 2450)) !== 200) throw new Error("Stripe's signed event was refused");
  if ((await api(member, "GET", `${base}/api/marketplace/orders/${unpaid.id}`)).order.status !== "paid") throw new Error("Stripe confirmed the exact total but the order is not paid");
  await api(page, "PATCH", `${base}/api/marketplace/orders/${unpaid.id}`, { status: "shipped" });
  await stripePaid(page, base, unpaid.id, 2450);
  if ((await api(member, "GET", `${base}/api/marketplace/orders/${unpaid.id}`)).order.status !== "shipped") throw new Error("a resent Stripe event moved a shipped order back");

  // ---- Related items ---------------------------------------------------------
  const { product: mug } = await api(page, "POST", `${base}/api/marketplace/products`, { name: "Prove Mug", basePrice: 10 });
  await api(page, "POST", `${base}/api/marketplace/products/${order.productId}/related`, { relatedIds: [mug.id] });
  await expectText(member, `${base}/marketplace/${order.productId}`, "Goes well with", "the member sees related items");
  await expectText(member, `${base}/marketplace/${order.productId}`, "Prove Mug", "the owner's pick shows on the product page");

  // ---- Price level: Wholesale 20% off the $24.50 lantern = $19.60 -------------
  const { level } = await api(page, "POST", `${base}/api/marketplace/pricing`, { action: "level", name: "Wholesale", percentOff: 20 });
  await api(page, "POST", `${base}/api/marketplace/pricing`, { action: "assign", customerEmail: member.email.toUpperCase(), levelId: level.id });
  await expectText(member, `${base}/marketplace/${order.productId}`, "19.60", "the member sees their wholesale price");
  const wholesale = await orderAs(member, base, order.productId, 2);
  if (Math.abs(wholesale.totalAmount - 39.2) > 0.001) throw new Error(`wholesale order $${wholesale.totalAmount}, want 2 × $19.60 = $39.20`);
  const stranger = await newMember();
  const listPriced = await orderAs(stranger, base, order.productId, 1);
  if (Math.abs(listPriced.totalAmount - 24.5) > 0.001) throw new Error(`another member paid $${listPriced.totalAmount}, want the list $24.50`);

  // ---- The customer's own price wins over their level ------------------------
  await api(page, "POST", `${base}/api/marketplace/pricing`, { action: "price", customerEmail: member.email, productId: mug.id, unitPrice: 7.25 });
  const own = await orderAs(member, base, mug.id, 3);
  if (Math.abs(own.totalAmount - 21.75) > 0.001) throw new Error(`own-price order $${own.totalAmount}, want 3 × $7.25 = $21.75`);

  // ---- Offer → counter → accepted: sticks for future orders from that quantity
  const { offer } = await api(member, "POST", `${base}/api/marketplace/offers`, { productId: order.productId, quantity: 10, unitPrice: 15, message: "For our youth group" });
  const selfAccept = await member.request.patch(`${base}/api/marketplace/offers/${offer.id}`, { data: { action: "accept" } });
  if (selfAccept.status() !== 403) throw new Error(`a member accepted their own offer (${selfAccept.status()})`);
  await expectText(page, `${base}/marketplace/offers`, "For our youth group", "the owner sees the offer");
  await api(page, "PATCH", `${base}/api/marketplace/offers/${offer.id}`, { action: "counter", unitPrice: 16.5 });
  await expectText(member, `${base}/marketplace/offers`, "Accept $16.50 each", "the member sees the counter-offer");
  await api(member, "PATCH", `${base}/api/marketplace/offers/${offer.id}`, { action: "accept-counter" });
  const ten = await orderAs(member, base, order.productId, 10);
  if (Math.abs(ten.totalAmount - 165) > 0.001) throw new Error(`agreed-price order $${ten.totalAmount}, want 10 × $16.50 = $165`);
  const again = await orderAs(member, base, order.productId, 12);
  if (Math.abs(again.totalAmount - 198) > 0.001) throw new Error(`the agreed price did not stick: $${again.totalAmount}, want 12 × $16.50 = $198`);
  const fewer = await orderAs(member, base, order.productId, 2);
  if (Math.abs(fewer.totalAmount - 39.2) > 0.001) throw new Error(`below the agreed quantity they should pay their level price: $${fewer.totalAmount}, want $39.20`);
  const settled = await page.request.patch(`${base}/api/marketplace/offers/${offer.id}`, { data: { action: "decline" } });
  if (settled.status() !== 409) throw new Error(`a settled offer changed again (${settled.status()})`);

  // ---- A one-time deal is used once, then the regular price is back -----------
  const { offer: once } = await api(member, "POST", `${base}/api/marketplace/offers`, { productId: mug.id, quantity: 1, unitPrice: 5 });
  await api(page, "PATCH", `${base}/api/marketplace/offers/${once.id}`, { action: "accept", sticky: false });
  const deal = await orderAs(member, base, mug.id, 1);
  if (Math.abs(deal.totalAmount - 5) > 0.001) throw new Error(`one-time deal order $${deal.totalAmount}, want $5`);
  const afterDeal = await orderAs(member, base, mug.id, 1);
  if (Math.abs(afterDeal.totalAmount - 7.25) > 0.001) throw new Error(`after a one-time deal they should be back on their own price $7.25, paid $${afterDeal.totalAmount}`);

  // ---- Only the owner sets prices --------------------------------------------
  const sneak = await member.request.post(`${base}/api/marketplace/pricing`, { data: { action: "level", name: "Me", percentOff: 90 } });
  if (sneak.status() !== 403) throw new Error(`a member created a price level (${sneak.status()})`);
}

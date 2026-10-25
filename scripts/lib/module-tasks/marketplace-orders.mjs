// Marketplace: the owner lists an item on the shop page, a member finds it and
// orders it through checkout, and the owner sees the order — including who
// placed it — and moves it along; the member sees the new status. A fresh shop
// sells only what the owner listed (nothing a member could order by mistake).
import { api, expectText } from "./_helpers.mjs";

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
}

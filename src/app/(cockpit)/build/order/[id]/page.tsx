import { OrderProgress } from "@/components/build/order-progress";

export const dynamic = "force-dynamic";

// Where Stripe Checkout returns a customer (C3). The cockpit layout already
// requires sign-in; the order API only answers its owner.
export default async function BuildOrderPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { id } = await params;
  const { cancelled } = await searchParams;

  return (
    <main className="shell">
      <OrderProgress orderId={id} cancelled={cancelled === "1"} />
    </main>
  );
}

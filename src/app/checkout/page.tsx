import { notFound } from "next/navigation";
import { CheckoutForm } from "@/features/checkout/components/checkout-form";
import { getCatalogService } from "@/features/catalog/server/get-catalog";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ item?: string; receiver?: string; receiverId?: string }> }) {
  const { item: itemId, receiver, receiverId } = await searchParams;
  if (!itemId || !receiver || !receiverId) notFound();
  const item = await (await getCatalogService()).find(itemId); if (!item) notFound();
  return <section className="flow-shell"><div className="flow-heading"><p className="eyebrow">PASO 2 DE 3</p><h1>Confirma y paga.</h1><p>El regalo se enviará únicamente al Epic ID mostrado después de validar el pago.</p></div><CheckoutForm item={item} receiver={receiver} receiverId={receiverId} /></section>;
}

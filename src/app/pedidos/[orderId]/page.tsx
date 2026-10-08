import { notFound } from "next/navigation";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { OrderStatus } from "@/features/orders/components/order-status";
import { PAYMENT_DETAILS } from "@/features/orders/config/payment-details";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";
import { getAppUrl } from "@/shared/server/app-url";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ access?: string }> }) {
  const [{ orderId }, { access }] = await Promise.all([params, searchParams]);
  const database = getSupabaseAdmin();
  if (!database || !access) notFound();
  const order = await new SupabaseOrderRepository(database).findByPublicToken(orderId, access);
  if (!order) notFound();

  return <section className="flow-shell order-tracking-page">
    <div className="flow-heading">
      <p className="eyebrow">PASO 3 DE 3</p>
      <h1>Pago y seguimiento.</h1>
      <p>Consulta tu compra, realiza el pago y anexa el comprobante para enviarlo a un administrador.</p>
    </div>
    <OrderStatus initialOrder={order} bank={PAYMENT_DETAILS} whatsappNumber={process.env.WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, "") || "5215619857749"} appUrl={getAppUrl()} />
  </section>;
}

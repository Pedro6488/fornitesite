import { notFound } from "next/navigation";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { OrderStatus } from "@/features/orders/components/order-status";
import { PAYMENT_DETAILS } from "@/features/orders/config/payment-details";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";
import { getAppUrl } from "@/shared/server/app-url";
import { GamePageHero } from "@/features/storefront/components/game-page-hero";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ access?: string }> }) {
  const [{ orderId }, { access }] = await Promise.all([params, searchParams]);
  const database = getSupabaseAdmin();
  if (!database || !access) notFound();
  const order = await new SupabaseOrderRepository(database).findByPublicToken(orderId, access);
  if (!order) notFound();

  return <section className="flow-shell order-tracking-page">
    <GamePageHero
      slim
      word="PEDIDO"
      accent="#8b5cf6"
      eyebrow="Paso 3 de 3"
      title={<>Pago y <span>seguimiento</span></>}
      lead="Consulta tu compra, realiza el pago y anexa el comprobante para enviarlo a un administrador."
    />
    <div className="loot-page-body">
      <OrderStatus initialOrder={order} bank={PAYMENT_DETAILS} whatsappNumber={process.env.WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, "") || "5215619857749"} appUrl={getAppUrl()} />
    </div>
  </section>;
}

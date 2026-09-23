import { notFound } from "next/navigation";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { OrderStatus } from "@/features/orders/components/order-status";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

export const dynamic = "force-dynamic";
export default async function OrderPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ access?: string }> }) {
  const [{ orderId }, { access }] = await Promise.all([params, searchParams]); const database = getSupabaseAdmin();
  if (!database || !access) notFound(); const order = await new SupabaseOrderRepository(database).findByPublicToken(orderId, access); if (!order) notFound();
  return <section className="flow-shell"><div className="flow-heading"><p className="eyebrow">PASO 3 DE 3</p><h1>Pago y envío.</h1><p>La entrega se habilita solamente después de validar el pago.</p></div><OrderStatus initialOrder={order} bank={{ name: process.env.BANK_NAME ?? "Configurar banco", beneficiary: process.env.BANK_BENEFICIARY ?? "Configurar beneficiario", clabe: process.env.BANK_CLABE ?? "Configurar CLABE" }} /></section>;
}

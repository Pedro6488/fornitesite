import { deliverOrder } from "@/features/fulfillment/application/deliver-order";
import { withDeliveryContext } from "@/features/fulfillment/server/delivery-route";

export const maxDuration = 60;

/**
 * «Enviar ahora — no se puede deshacer». Con `confirmPayment: true` confirma
 * antes el pago. Cada objeto se aparta antes de llamar a gift_send.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const body = await request.json().catch(() => ({})) as { confirmPayment?: unknown };
  return withDeliveryContext(request, params, async ({ orderId, user, store, fnshop }) => ({
    report: await deliverOrder({ orderId, actorId: user.id, confirmPayment: body.confirmPayment === true }, { store, fnshop }),
  }));
}

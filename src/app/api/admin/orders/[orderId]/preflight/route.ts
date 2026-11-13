import { preflightOrder } from "@/features/fulfillment/application/deliver-order";
import { withDeliveryContext } from "@/features/fulfillment/server/delivery-route";

export const maxDuration = 60;

/** Pre-vuelo: un gift_check por objeto pendiente. No envía nada. */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  return withDeliveryContext(request, params, async ({ orderId, user, store, fnshop }) => ({
    items: await preflightOrder(orderId, { store, fnshop, actorId: user.id }),
  }));
}

import { reconcileOrder } from "@/features/fulfillment/application/deliver-order";
import { withDeliveryContext } from "@/features/fulfillment/server/delivery-route";

export const maxDuration = 60;

/** Conciliar: busca en order_history los envíos con resultado dudoso. 1 request por objeto dudoso. */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  return withDeliveryContext(request, params, async ({ orderId, user, store, fnshop }) => ({
    report: await reconcileOrder({ orderId, actorId: user.id }, { store, fnshop }),
  }));
}

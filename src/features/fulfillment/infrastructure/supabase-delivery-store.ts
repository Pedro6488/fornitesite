import type { SupabaseClient } from "@supabase/supabase-js";
import { sendOperationsAlert } from "@/features/fnshop/server/get-fnshop-client";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import type { OrderStatus } from "@/features/orders/domain/order";
import type { DeliveryItem, DeliveryOrder, DeliveryStore, FulfillmentStatus, ItemFinish } from "../application/deliver-order";

type OrderRow = {
  id: string; status: OrderStatus; epic_display_name: string; recipient_platform: string | null; epic_account_id: string;
  recipient_validation_id: string | null;
  order_items: { id: string; item_main_id: string; offer_id: string; item_name: string; vbucks_price: number; created_at: string }[];
};
type FulfillmentRow = { order_item_id: string | null; status: FulfillmentStatus; started_at: string | null };

export class SupabaseDeliveryStore implements DeliveryStore {
  private readonly orders: SupabaseOrderRepository;

  constructor(private readonly database: SupabaseClient) {
    this.orders = new SupabaseOrderRepository(database);
  }

  async load(orderId: string): Promise<DeliveryOrder | null> {
    const { data: order, error } = await this.database.from("orders")
      .select("id,status,epic_display_name,recipient_platform,epic_account_id,recipient_validation_id,order_items(id,item_main_id,offer_id,item_name,vbucks_price,created_at)")
      .eq("id", orderId).maybeSingle<OrderRow>();
    if (error) throw error;
    if (!order) return null;
    const [{ data: fulfillments, error: fulfillmentError }, validation] = await Promise.all([
      this.database.from("fulfillments").select("order_item_id,status,started_at").eq("order_id", orderId).returns<FulfillmentRow[]>(),
      order.recipient_validation_id
        ? this.database.from("game_id_validations").select("provider_receiver_id").eq("id", order.recipient_validation_id).maybeSingle<{ provider_receiver_id: string | null }>()
        : Promise.resolve({ data: null }),
    ]);
    if (fulfillmentError) throw fulfillmentError;
    const byItem = new Map((fulfillments ?? []).filter((row) => row.order_item_id).map((row) => [row.order_item_id!, row]));
    const items: DeliveryItem[] = (order.order_items ?? [])
      .toSorted((left, right) => left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id))
      .map((item) => {
        const fulfillment = byItem.get(item.id);
        return {
          id: item.id, itemMainId: item.item_main_id, offerId: item.offer_id, name: item.item_name, vbucksPrice: item.vbucks_price,
          fulfillment: fulfillment ? { status: fulfillment.status, startedAt: fulfillment.started_at } : null,
        };
      });
    return {
      id: order.id, status: order.status, displayName: order.epic_display_name, platform: order.recipient_platform ?? "epic",
      epicAccountId: order.epic_account_id, providerReceiverId: validation.data?.provider_receiver_id ?? null, items,
    };
  }

  transition(orderId: string, from: OrderStatus, to: OrderStatus, metadata: Record<string, unknown>) {
    return this.orders.transition(orderId, from, to, metadata);
  }

  async claim(order: DeliveryOrder, item: DeliveryItem, input: { receiver: string; receiverId: string | null; actorId: string }): Promise<boolean> {
    const values = {
      offer_id: item.offerId, receiver: input.receiver, receiver_id: input.receiverId, actor_id: input.actorId,
      status: "sending", started_at: new Date().toISOString(), finished_at: null, result_code: null, last_error: null, updated_at: new Date().toISOString(),
    };
    const { error } = await this.database.from("fulfillments").insert({ order_id: order.id, order_item_id: item.id, provider: "fnshop", attempts: 1, ...values });
    if (!error) return true;
    if (error.code !== "23505") throw error;
    // Ya existía: solo se vuelve a intentar un envío rechazado. sending, unknown y sent quedan bloqueados.
    const { data, error: retryError } = await this.database.from("fulfillments")
      .update(values).eq("order_item_id", item.id).eq("status", "failed").select("id").maybeSingle();
    if (retryError) throw retryError;
    return Boolean(data);
  }

  async finish(itemId: string, result: ItemFinish): Promise<void> {
    const values = result.status === "sent"
      ? { status: "sent", track_id: result.trackId, external_id: result.trackId, sender_account_id: result.senderId, sender_name: result.senderName, final_price_vbucks: result.finalPrice, result_code: result.code, last_error: null }
      : { status: result.status, result_code: result.code, last_error: result.message, sender_account_id: result.senderId ?? null, sender_name: result.senderName ?? null };
    const { error } = await this.database.from("fulfillments")
      .update({ ...values, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("order_item_id", itemId);
    if (error) throw error;
  }

  async updateOffer(itemId: string, offerId: string): Promise<void> {
    const { error } = await this.database.from("order_items").update({ offer_id: offerId }).eq("id", itemId);
    if (error) throw error;
  }

  alert(text: string, dedupeKey: string, orderId: string) {
    return sendOperationsAlert(this.database, text, dedupeKey, `/admin/pedidos/${orderId}`);
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, OrderRepository, OrderStatus } from "../domain/order";

type OrderRow = {
  id: string; public_token: string; status: OrderStatus; customer_email: string; epic_account_id: string;
  epic_display_name: string; item_main_id: string; offer_id: string; item_name: string; item_image_url: string | null;
  vbucks_price: number; amount_mxn_cents: number; payment_method: "mercado_pago" | "bank_transfer"; created_at: string;
};

export class SupabaseOrderRepository implements OrderRepository {
  constructor(private readonly database: SupabaseClient) {}

  async create(input: Omit<Order, "id" | "publicToken" | "createdAt">): Promise<Order> {
    const { data, error } = await this.database.from("orders").insert({
      status: input.status, customer_email: input.customerEmail, epic_account_id: input.epicAccountId,
      epic_display_name: input.epicDisplayName, item_main_id: input.itemMainId, offer_id: input.offerId,
      item_name: input.itemName, item_image_url: input.itemImageUrl, vbucks_price: input.vbucksPrice,
      amount_mxn_cents: input.amountMxnCents, payment_method: input.paymentMethod
    }).select().single<OrderRow>();
    if (error) throw error;
    return mapRow(data);
  }

  async findById(id: string): Promise<Order | null> {
    const { data, error } = await this.database.from("orders").select("*").eq("id", id).maybeSingle<OrderRow>();
    if (error) throw error; return data ? mapRow(data) : null;
  }

  async findByPublicToken(id: string, publicToken: string): Promise<Order | null> {
    const { data, error } = await this.database.from("orders").select("*").eq("id", id).eq("public_token", publicToken).maybeSingle<OrderRow>();
    if (error) throw error; return data ? mapRow(data) : null;
  }

  async transition(id: string, from: OrderStatus, to: OrderStatus, metadata: Record<string, unknown> = {}): Promise<boolean> {
    const { data, error } = await this.database.rpc("transition_order", { p_order_id: id, p_from: from, p_to: to, p_metadata: metadata });
    if (error) throw error; return Boolean(data);
  }
}

function mapRow(row: OrderRow): Order {
  return { id: row.id, publicToken: row.public_token, status: row.status, customerEmail: row.customer_email,
    epicAccountId: row.epic_account_id, epicDisplayName: row.epic_display_name, itemMainId: row.item_main_id,
    offerId: row.offer_id, itemName: row.item_name, itemImageUrl: row.item_image_url, vbucksPrice: row.vbucks_price,
    amountMxnCents: row.amount_mxn_cents, paymentMethod: row.payment_method, createdAt: row.created_at };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, OrderLine, OrderRepository, OrderStatus, SupervisorStatus } from "../domain/order";

type OrderRow = {
  id: string; public_token: string; status: OrderStatus; customer_email: string | null; epic_account_id: string;
  epic_display_name: string; item_main_id: string; offer_id: string; item_name: string; item_image_url: string | null;
  vbucks_price: number; amount_mxn_cents: number; payment_method: "mercado_pago" | "bank_transfer"; created_at: string;
  supervisor_status?: SupervisorStatus;
  recipient_platform?: "epic" | "xbl" | "psn" | "nintendo";
  contact_whatsapp?: string | null;
  order_items?: { item_name: string; quantity: number; unit_amount_mxn_cents: number }[];
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
    const { data, error } = await this.database.from("orders").select("*,order_items(item_name,quantity,unit_amount_mxn_cents)").eq("id", id).maybeSingle<OrderRow>();
    if (error) throw error; return data ? mapRow(data) : null;
  }

  async findByPublicToken(id: string, publicToken: string): Promise<Order | null> {
    const { data, error } = await this.database.from("orders").select("*,order_items(item_name,quantity,unit_amount_mxn_cents)").eq("id", id).eq("public_token", publicToken).maybeSingle<OrderRow>();
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
    amountMxnCents: row.amount_mxn_cents, paymentMethod: row.payment_method, recipientPlatform: row.recipient_platform,
    contactWhatsapp: row.contact_whatsapp, supervisorStatus: row.supervisor_status ?? "pending_confirmation",
    items: (row.order_items?.map((item): OrderLine => ({ itemName: item.item_name, quantity: item.quantity, unitAmountMxnCents: item.unit_amount_mxn_cents })) ?? [{ itemName: row.item_name, quantity: 1, unitAmountMxnCents: row.amount_mxn_cents }]), createdAt: row.created_at };
}

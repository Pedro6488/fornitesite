export type DeliveredOrderCustomer = {
  epic_account_id: string;
  epic_display_name: string;
  customer_email: string | null;
  amount_mxn_cents: number;
  delivered_at: string | null;
  created_at: string;
};

export type CustomerRankingEntry = {
  recipientName: string;
  customerEmail: string | null;
  deliveredOrders: number;
};

export function rankCustomersByDeliveredOrders(orders: readonly DeliveredOrderCustomer[]): CustomerRankingEntry[] {
  const customers = new Map<string, CustomerRankingEntry & { latestDeliveredAt: string; totalMxnCents: number }>();

  for (const order of orders) {
    const deliveredAt = order.delivered_at ?? order.created_at;
    const current = customers.get(order.epic_account_id);
    if (!current) {
      customers.set(order.epic_account_id, {
        recipientName: order.epic_display_name,
        customerEmail: order.customer_email,
        deliveredOrders: 1,
        latestDeliveredAt: deliveredAt,
        totalMxnCents: order.amount_mxn_cents,
      });
      continue;
    }

    current.deliveredOrders += 1;
    current.totalMxnCents += order.amount_mxn_cents;
    if (deliveredAt > current.latestDeliveredAt) {
      current.latestDeliveredAt = deliveredAt;
      current.recipientName = order.epic_display_name;
      current.customerEmail = order.customer_email;
    }
  }

  return [...customers.values()]
    .sort((left, right) => right.deliveredOrders - left.deliveredOrders
      || right.totalMxnCents - left.totalMxnCents
      || left.recipientName.localeCompare(right.recipientName, "es-MX", { sensitivity: "base" }))
    .map((customer) => ({
      recipientName: customer.recipientName,
      customerEmail: customer.customerEmail,
      deliveredOrders: customer.deliveredOrders,
    }));
}

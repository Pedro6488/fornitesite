import { OrderDetail } from "@/features/admin/components/order-detail";

export default async function AdminOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderDetail orderId={orderId} />;
}

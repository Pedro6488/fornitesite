import { OrdersBoard } from "@/features/admin/components/orders-board";

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ cola?: string | string[] }> }) {
  const { cola } = await searchParams;
  return <OrdersBoard initialQueue={Array.isArray(cola) ? cola[0] : cola} />;
}

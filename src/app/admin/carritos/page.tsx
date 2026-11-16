import { AdminCarts } from "@/features/admin/components/store-sections";

export default async function AdminCartsPage({ searchParams }: { searchParams: Promise<{ cart?: string | string[] }> }) {
  const { cart } = await searchParams;
  return <AdminCarts focusCartId={Array.isArray(cart) ? cart[0] : cart} />;
}

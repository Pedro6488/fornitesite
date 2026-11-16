import { redirect } from "next/navigation";
import { AdminHome } from "@/features/admin/components/admin-home";
import { legacyAdminPath } from "@/features/admin/application/order-queues";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[]; order?: string | string[]; cart?: string | string[] }> }) {
  const { tab, order, cart } = await searchParams;
  // Los avisos de Telegram anteriores a la consola siguen abriendo su pedido.
  const legacy = legacyAdminPath({ tab: first(tab), order: first(order), cart: first(cart) });
  if (legacy) redirect(legacy);
  return <AdminHome />;
}

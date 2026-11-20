import { z } from "zod";
import { AdminWallet } from "@/features/wallet/components/admin-wallet";
/** `?cliente=<id>` abre directo el historial, por ejemplo desde una recarga por liberar. */
export default async function AdminPavosClientsPage({ searchParams }: { searchParams: Promise<{ cliente?: string | string[] }> }) {
  const { cliente } = await searchParams;
  const initialClient = typeof cliente === "string" && z.uuid().safeParse(cliente).success ? cliente : null;
  return <AdminWallet view="clients" initialClient={initialClient} />;
}

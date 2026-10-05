import { AccountAccess } from "@/features/auth/components/account-access";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const requestedNext = (await searchParams).next;
  const nextPath = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/cuenta";
  return <section className="flow-shell"><div className="flow-heading"><p className="eyebrow">TU CUENTA</p><h1>Tu loot, siempre localizado.</h1><p>Regístrate con tu correo e ID de Fortnite para revisar favoritos, disponibilidad y el estado de cada compra.</p></div><AccountAccess nextPath={nextPath} /></section>;
}

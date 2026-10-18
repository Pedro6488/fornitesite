import { AccountAccess } from "@/features/auth/components/account-access";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const params = await searchParams;
  const requestedNext = params.next;
  const nextPath = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/cuenta";
  const initialMode = params.mode === "register" ? "register" : "login";
  return <section className="account-page"><header className="account-page-heading"><p className="eyebrow">TU CUENTA</p><h1>Tu loot, siempre localizado.</h1><p>Administra tus IDs de entrega, favoritos y el seguimiento de cada compra desde un solo lugar.</p></header><AccountAccess nextPath={nextPath} initialMode={initialMode} /></section>;
}

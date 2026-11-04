import { AccountAccess } from "@/features/auth/components/account-access";
import { GamePageHero } from "@/features/storefront/components/game-page-hero";

export default function AdminAccessPage() {
  return <section className="flow-shell"><GamePageHero slim word="ADMIN" accent="#8b5cf6" eyebrow="Administración" title={<>Acceso al <span>panel</span></>} lead="Inicia sesión con uno de los correos autorizados para administrar pedidos, transferencias y precios." /><div className="loot-page-body"><AccountAccess nextPath="/admin" adminAccess /></div></section>;
}

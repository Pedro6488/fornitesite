import { Trophy } from "lucide-react";
import { CommunityNav } from "@/features/community/components/community-nav";
import { getPublicCustomerRanking } from "@/features/community/server/get-community";
import { GamePageHero } from "@/features/storefront/components/game-page-hero";

export const dynamic = "force-dynamic";

const PODIUM_LABELS = ["1er lugar", "2do lugar", "3er lugar"] as const;

const deliveries = (count: number) => `${count} ${count === 1 ? "entrega" : "entregas"}`;

export default async function CustomersPage() {
  const customers = await getPublicCustomerRanking();
  const podium = customers.slice(0, 3);
  const rest = customers.slice(3);
  return <section className="community-page">
    <GamePageHero
      slim
      word="CLIENTES"
      accent="#8b5cf6"
      eyebrow="Comunidad SigfriedLootBox"
      title={<>Clientes <span>recurrentes</span></>}
      lead="Ranking público basado únicamente en pedidos entregados."
    />
    <div className="loot-page-body">
      <CommunityNav active="clientes" summary={customers.length > 0 ? `${customers.length} ${customers.length === 1 ? "cliente" : "clientes"}` : undefined} />
      {customers.length === 0 ? <div className="loot-empty"><span aria-hidden="true"><Trophy size={26} /></span><h2>Aún no hay entregas registradas</h2><p>El ranking aparecerá cuando se confirmen las primeras entregas.</p></div> : <>
        <ol className="community-podium">
          {podium.map((customer, index) => <li data-place={index + 1} key={`${customer.recipientName}-${index}`}>
            <span className="community-place" aria-hidden="true">{index + 1}</span>
            <small>{PODIUM_LABELS[index]}</small>
            <strong>{customer.recipientName}</strong>
            <b>{deliveries(customer.deliveredOrders)}</b>
          </li>)}
        </ol>
        {rest.length > 0 && <ol className="community-ranking" start={4}>
          {rest.map((customer, index) => <li key={`${customer.recipientName}-${index}`}>
            <span>#{index + 4}</span>
            <strong>{customer.recipientName}</strong>
            <b>{deliveries(customer.deliveredOrders)}</b>
          </li>)}
        </ol>}
      </>}
    </div>
  </section>;
}

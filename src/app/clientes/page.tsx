import Link from "next/link";
import { getPublicCustomerRanking } from "@/features/community/server/get-community";
import { BackButton } from "@/shared/components/back-button";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await getPublicCustomerRanking();
  return <section className="community-page">
    <header className="community-heading"><p className="eyebrow">COMUNIDAD SIGFRIEDLOOTBOX</p><h1>Clientes recurrentes</h1><p>Ranking público basado únicamente en pedidos entregados.</p></header>
    <BackButton fallbackHref="/#catalogo" label="Atrás" />
    <nav className="community-tabs" aria-label="Comunidad"><Link className="active" href="/clientes">Clientes</Link><Link href="/referencias">Referencias</Link></nav>
    {customers.length === 0 ? <p className="notice">Aún no hay entregas registradas.</p> : <div className="community-ranking">
      {customers.map((customer, index) => <article key={`${customer.recipientName}-${index}`}><span>{index === 0 ? "1er lugar" : index === 1 ? "2do lugar" : index === 2 ? "3er lugar" : `#${index + 1}`}</span><strong>{customer.recipientName}</strong><b>{customer.deliveredOrders} {customer.deliveredOrders === 1 ? "entrega" : "entregas"}</b></article>)}
    </div>}
  </section>;
}

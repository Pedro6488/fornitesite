import Link from "next/link";
import { getPublicDeliveryReferences } from "@/features/community/server/get-community";
import { BackButton } from "@/shared/components/back-button";

export const dynamic = "force-dynamic";

export default async function ReferencesPage() {
  const references = await getPublicDeliveryReferences();
  return <section className="community-page">
    <header className="community-heading"><p className="eyebrow">ENTREGAS CONFIRMADAS</p><h1>Referencias de clientes</h1><p>Comentarios y evidencias que los clientes compartieron después de recibir sus productos.</p></header>
    <BackButton fallbackHref="/#catalogo" label="Atrás" />
    <nav className="community-tabs" aria-label="Comunidad"><Link href="/clientes">Clientes</Link><Link className="active" href="/referencias">Referencias</Link></nav>
    {references.length === 0 ? <p className="notice">Aún no hay referencias públicas.</p> : <div className="community-references">
      {references.map((reference, index) => <article key={`${reference.recipientName}-${reference.createdAt}-${index}`}><header><strong>{reference.recipientName}</strong><time dateTime={reference.createdAt}>{new Date(reference.createdAt).toLocaleDateString("es-MX", { dateStyle: "medium" })}</time></header><ul>{reference.items.map((item, itemIndex) => <li key={`${item.item_name}-${itemIndex}`}>{item.quantity}× {item.item_name}</li>)}</ul>{reference.comment && <blockquote>“{reference.comment}”</blockquote>}{reference.imageUrls.length > 0 && <div className="community-reference-gallery">{reference.imageUrls.map((imageUrl, imageIndex) => <a key={imageUrl} href={imageUrl} target="_blank" rel="noreferrer"><img src={imageUrl} alt={`Evidencia ${imageIndex + 1} de ${reference.recipientName}`} /></a>)}</div>}</article>)}
    </div>}
  </section>;
}

import { BadgeCheck, MessageSquareQuote } from "lucide-react";
import { CommunityNav } from "@/features/community/components/community-nav";
import { ReferenceGallery } from "@/features/community/components/reference-gallery";
import { getPublicDeliveryReferences } from "@/features/community/server/get-community";
import { GamePageHero } from "@/features/storefront/components/game-page-hero";

export const dynamic = "force-dynamic";

export default async function ReferencesPage() {
  const references = await getPublicDeliveryReferences();
  return <section className="community-page">
    <GamePageHero
      slim
      word="REFERENCIAS"
      accent="#8b5cf6"
      eyebrow="Entregas confirmadas"
      title={<>Referencias <span>de clientes</span></>}
      lead="Comentarios y evidencias que los clientes compartieron después de recibir sus productos."
    />
    <div className="loot-page-body">
      <CommunityNav active="referencias" summary={references.length > 0 ? `${references.length} ${references.length === 1 ? "referencia" : "referencias"}` : undefined} />
      {references.length === 0 ? <div className="loot-empty"><span aria-hidden="true"><MessageSquareQuote size={26} /></span><h2>Aún no hay referencias públicas</h2><p>Aquí verás los comentarios y evidencias de las entregas confirmadas.</p></div> : <div className="community-references">
        {references.map((reference, index) => <article key={`${reference.recipientName}-${reference.createdAt}-${index}`}>
          {reference.imageUrls.length > 0 && <ReferenceGallery images={reference.imageUrls} owner={reference.recipientName} />}
          <div className="community-reference-body">
            {reference.comment && <blockquote>“{reference.comment}”</blockquote>}
            <ul>{reference.items.map((item, itemIndex) => <li key={`${item.item_name}-${itemIndex}`}>{item.quantity}× {item.item_name}</li>)}</ul>
            <footer>
              <span className="community-avatar" aria-hidden="true">{reference.recipientName.slice(0, 1).toUpperCase()}</span>
              <span><strong>{reference.recipientName}</strong><small><BadgeCheck aria-hidden="true" size={13} />Entrega confirmada</small></span>
              <time dateTime={reference.createdAt}>{new Date(reference.createdAt).toLocaleDateString("es-MX", { dateStyle: "medium" })}</time>
            </footer>
          </div>
        </article>)}
      </div>}
    </div>
  </section>;
}

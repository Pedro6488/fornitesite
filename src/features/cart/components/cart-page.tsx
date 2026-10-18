"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { useCommerceState } from "@/features/commerce/components/commerce-state-provider";
import { getIdentityPresentation } from "@/features/commerce/application/identity-presentation";
import { SystemActionBar } from "@/shared/components/system-action-bar";
import { resolveCartAvailability } from "../application/cart-availability";

export function CartPage({ items }: { items: readonly CatalogItem[] }) {
  const router = useRouter();
  const commerce = useCommerceState();
  const [message, setMessage] = useState<string | null>(null);
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const lines = useMemo(() => resolveCartAvailability(commerce.cartItemIds, items), [commerce.cartItemIds, items]);
  const unavailableLines = lines.filter((line) => !line.available);
  const total = lines.reduce((sum, line) => sum + (line.available ? line.item?.priceMxn ?? 0 : 0), 0);
  const canContinue = lines.length > 0 && unavailableLines.length === 0;
  const identity = getIdentityPresentation(commerce.validation);
  const nextStep = !commerce.validation ? "Siguiente: agregar ID"
    : commerce.validation.status === "manual_review" ? "ID en revisión"
      : commerce.validation.status === "pending_friendship" ? "Solicitud de amistad pendiente"
        : commerce.validation.status === "waiting" ? identity.description.replace(/\.$/, "")
          : commerce.validation.status === "ready" ? "Siguiente: confirmar precio"
            : "Selecciona otro ID";
  async function remove(itemId: string) { setMessage(await commerce.removeCartItem(itemId)); }
  async function removeUnavailable() {
    if (unavailableLines[0]) setMessage(await commerce.removeCartItem(unavailableLines[0].itemId));
  }
  function continueToCheckout() {
    if (!canContinue || openingCheckout) return;
    setOpeningCheckout(true);
    router.push("/checkout");
  }

  return <section className="cart-page">
    <header className="cart-heading"><div><p className="eyebrow">TU CARRITO</p><h1>Tu selección</h1><p>{unavailableLines.length ? `${unavailableLines.length} ${unavailableLines.length === 1 ? "objeto requiere" : "objetos requieren"} atención.` : lines.length === 1 ? "1 objeto listo para continuar." : `${lines.length} objetos listos para continuar.`}</p></div></header>
    {!commerce.ready ? <div className="cart-empty"><h2>Cargando tu carrito…</h2></div> : lines.length === 0 ? <div className="cart-empty"><h2>Tu carrito está vacío</h2><p>Explora los objetos disponibles y agrega los que quieras solicitar.</p><Link href="/#catalogo">Ver tienda</Link></div> : <div className="cart-layout">
      <div className="cart-lines">
        {unavailableLines.length > 0 && <div className="cart-unavailable-notice" role="status"><div><strong>Tu carrito cambió</strong><span>Estos objetos salieron de la tienda y deben quitarse antes de continuar.</span></div><button type="button" onClick={() => void removeUnavailable()} disabled={commerce.syncing}>Quitar no disponibles</button></div>}
        {lines.map(({ itemId, item, available }) => <article className={`cart-line ${available ? "" : "cart-line-unavailable"}`} key={itemId}>
          {item ? <Link className="cart-product-link" href={`/objetos/${encodeURIComponent(item.mainId)}`}>
            <div className="cart-item-image">{item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="(max-width: 600px) 72px, 88px" /> : <span aria-hidden="true">{item.name.slice(0, 1)}</span>}</div>
            <div className="cart-item-copy"><p>{item.type} · {item.rarity}</p><h2>{item.name}</h2><span>{available ? `◉ ${item.finalPriceVbucks.toLocaleString("es-MX")} · 1 unidad` : "Ya no está disponible en la tienda"}</span></div>
          </Link> : <div className="cart-product-link">
            <div className="cart-item-image cart-item-missing"><span aria-hidden="true">!</span></div>
            <div className="cart-item-copy"><p>OFERTA FINALIZADA</p><h2>Objeto ya no disponible</h2><span>Salió del catálogo actual</span></div>
          </div>}
          <div className="cart-line-price"><strong>{available && item?.priceMxn !== null ? formatMxn(item?.priceMxn ?? 0) : "No disponible"}</strong><span>{available ? "MXN" : "Quítalo para continuar"}</span></div>
          <button className="cart-remove" onClick={() => void remove(itemId)} aria-label={`Quitar ${item?.name ?? "objeto no disponible"} del carrito`}><Trash2 aria-hidden="true" size={16} /><span>Eliminar</span></button>
        </article>)}
        {message && <p className="notice error">{message}</p>}
        <Link className="cart-continue-shopping" href="/#catalogo"><ArrowLeft aria-hidden="true" size={15} />Seguir comprando</Link>
      </div>
      <aside className="cart-summary">
        <section className="cart-trust-panel" aria-label="Compra protegida">
          <span><ShieldCheck aria-hidden="true" size={19} /></span>
          <div><strong>Compra protegida</strong><p>Precio y disponibilidad se confirman antes de crear tu pedido.</p></div>
        </section>
        <div className="cart-summary-heading"><div><p className="eyebrow">RESUMEN</p><h2>Tu pedido</h2></div><b>{lines.length}</b></div>
        <div className="cart-summary-row"><span>Objetos</span><strong>{lines.length}</strong></div>
        <div className="cart-summary-total"><span>Total estimado</span><strong>{formatMxn(total)} <small>MXN</small></strong></div>
        <p className="cart-summary-note"><ShieldCheck aria-hidden="true" size={17} />{nextStep}</p>
        {canContinue ? <button type="button" className="primary-button" disabled={openingCheckout} onClick={continueToCheckout}>{openingCheckout ? "Abriendo compra…" : <>Continuar compra <ArrowRight aria-hidden="true" size={17} /></>}</button> : <button className="primary-button" disabled>Hay objetos no disponibles</button>}
        <ol className="cart-next-steps" aria-label="Progreso de compra"><li className="complete active" aria-current="step"><b><Check aria-hidden="true" size={12} /></b><span>Carrito</span></li><li><b>2</b><span>ID y precio</span></li><li><b>3</b><span>Contacto y orden</span></li></ol>
      </aside>
      <SystemActionBar className="mobile-cart-checkout" primaryFull><span><small>Resumen de compra</small><strong>{formatMxn(total)}</strong><em>{nextStep}</em></span>{canContinue ? <button type="button" disabled={openingCheckout} onClick={continueToCheckout}>{openingCheckout ? "Abriendo compra…" : <>Continuar compra <ArrowRight aria-hidden="true" size={17} /></>}</button> : <button disabled>No disponible</button>}</SystemActionBar>
    </div>}
  </section>;
}

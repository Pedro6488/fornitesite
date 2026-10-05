"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import type { CatalogItem } from "../domain/catalog-item";
import { canPurchase } from "../domain/catalog-item";
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";
import { FavoriteButton } from "@/features/catalog/components/favorite-button";
import { useCommerceState, type IdentityPlatform } from "@/features/commerce/components/commerce-state-provider";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { SystemActionBar } from "@/shared/components/system-action-bar";

export function ProductPurchaseActions({ item }: { item: CatalogItem }) {
  const commerce = useCommerceState();
  const purchasable = canPurchase(item);
  const inCart = commerce.ready && commerce.cartItemIds.includes(item.mainId);
  const manualReview = commerce.validation?.status === "manual_review";
  const ready = commerce.validation?.status === "ready";
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [platform, setPlatform] = useState<IdentityPlatform>("epic");
  const [identityMessage, setIdentityMessage] = useState<string | null>(null);

  function toggleIdentityEditor() {
    if (!editingIdentity) {
      setDisplayName(commerce.validation?.submitted_id ?? "");
      setPlatform(commerce.validation?.platform ?? "epic");
      setIdentityMessage(null);
    }
    setEditingIdentity((current) => !current);
  }

  async function saveIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = await commerce.validateIdentity(displayName, platform);
    setIdentityMessage(message);
    if (!message) setEditingIdentity(false);
  }

  return <div className="product-purchase-actions">
    <div className={`product-identity-status ${ready ? "ready" : manualReview ? "manual" : ""}`}>
      <span aria-hidden="true">{ready ? "✓" : manualReview ? "◌" : "◎"}</span>
      <div><strong>{ready || manualReview ? commerce.validation?.display_name : "Agrega tu ID cuando quieras"}</strong><small>{ready ? "Listo para recibir objetos" : manualReview ? "ID enviado · espera única de 48 horas" : "Puedes continuar sin validarlo ahora"}</small></div>
      <button type="button" onClick={toggleIdentityEditor}>{editingIdentity ? "Cerrar" : ready || manualReview ? "Cambiar" : "Agregar ID"}</button>
    </div>
    {editingIdentity && <form className="product-inline-identity" onSubmit={saveIdentity}>
      <div><label>ID o gamertag<input required minLength={3} maxLength={32} autoComplete="off" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Tu usuario en Fortnite" /></label><label>Plataforma<span className="select-control"><select value={platform} onChange={(event) => setPlatform(event.target.value as IdentityPlatform)}><option value="epic">Epic Games</option><option value="xbl">Xbox</option><option value="psn">PlayStation</option><option value="nintendo">Nintendo Switch</option></select><ChevronDown aria-hidden="true" size={16} /></span></label></div>
      <button className="primary-button" disabled={commerce.syncing}>{commerce.syncing ? "Guardando…" : "Guardar ID"}</button>
      {identityMessage && <p className="notice error" role="alert">{identityMessage}</p>}
    </form>}
    {inCart ? <SystemActionBar className="product-main-actions"><div className="product-action-price"><span><small>Precio del objeto</small><strong>{item.priceMxn === null ? "Consultar" : formatMxn(item.priceMxn)}</strong></span><span><small>En Fortnite</small><b>◉ {item.finalPriceVbucks.toLocaleString("es-MX")} paVos</b></span></div><div className="product-action-buttons"><Link className="primary-button" href="/carrito">Continuar compra</Link><FavoriteButton itemId={item.mainId} itemName={item.name} variant="detail" /></div></SystemActionBar> : purchasable ? <SystemActionBar className="product-main-actions"><div className="product-action-price"><span><small>Precio del objeto</small><strong>{item.priceMxn === null ? "Consultar" : formatMxn(item.priceMxn)}</strong></span><span><small>En Fortnite</small><b>◉ {item.finalPriceVbucks.toLocaleString("es-MX")} paVos</b></span></div><div className="product-action-buttons"><AddToCartButton item={item} /><FavoriteButton itemId={item.mainId} itemName={item.name} variant="detail" /></div></SystemActionBar> : <><div className="product-unavailable"><strong>Este objeto no está disponible para solicitar ahora.</strong><span>Guárdalo en favoritos y vuelve a revisar su disponibilidad.</span></div><SystemActionBar className="product-main-actions"><div className="product-action-price"><span><small>Disponibilidad</small><strong>No disponible</strong></span><span><small>Último precio</small><b>◉ {item.finalPriceVbucks.toLocaleString("es-MX")} paVos</b></span></div><div className="product-action-buttons"><Link className="primary-button" href="/#catalogo">Explorar disponibles</Link><FavoriteButton itemId={item.mainId} itemName={item.name} variant="detail" /></div></SystemActionBar></>}
  </div>;
}

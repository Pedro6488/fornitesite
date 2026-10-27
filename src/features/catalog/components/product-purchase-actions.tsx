"use client";

import Link from "next/link";
import type { CatalogItem } from "../domain/catalog-item";
import { canPurchase } from "../domain/catalog-item";
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";
import { FavoriteButton } from "@/features/catalog/components/favorite-button";
import { useCommerceState } from "@/features/commerce/components/commerce-state-provider";
import { getIdentityPresentation } from "@/features/commerce/application/identity-presentation";
import { useRegionalPrice } from "@/features/pricing/components/regional-price";
import { SystemActionBar } from "@/shared/components/system-action-bar";

export function ProductPurchaseActions({ item }: { item: CatalogItem }) {
  const commerce = useCommerceState();
  const purchasable = canPurchase(item);
  const inCart = commerce.ready && commerce.cartItemIds.includes(item.mainId);
  const identity = getIdentityPresentation(commerce.validation);
  const regionalPrice = useRegionalPrice(item.finalPriceVbucks, item.priceMxn);
  const price = <>{regionalPrice.label}{regionalPrice.currency && <small>{regionalPrice.currency}</small>}</>;

  return <div className="product-purchase-actions">
    <div className={`product-identity-status ${identity.tone}`}>
      <span aria-hidden="true">{identity.tone === "success" ? "✓" : identity.tone === "danger" ? "×" : identity.tone === "warning" ? "◷" : "◎"}</span>
      <div><strong>{commerce.validation?.display_name ?? identity.label}</strong><small>{identity.description}</small></div>
      <button type="button" onClick={commerce.openIdentity}>{identity.actionLabel}</button>
    </div>
    {inCart ? <SystemActionBar className="product-main-actions"><div className="product-action-price"><span><small>Precio del objeto</small><strong>{price}</strong></span><span><small>En Fortnite</small><b>◉ {item.finalPriceVbucks.toLocaleString("es-MX")} paVos</b></span></div><div className="product-action-buttons"><Link className="primary-button" href="/carrito">Continuar compra</Link><FavoriteButton itemId={item.mainId} itemName={item.name} variant="detail" /></div></SystemActionBar> : purchasable ? <SystemActionBar className="product-main-actions"><div className="product-action-price"><span><small>Precio del objeto</small><strong>{price}</strong></span><span><small>En Fortnite</small><b>◉ {item.finalPriceVbucks.toLocaleString("es-MX")} paVos</b></span></div><div className="product-action-buttons"><AddToCartButton item={item} /><FavoriteButton itemId={item.mainId} itemName={item.name} variant="detail" /></div></SystemActionBar> : <><div className="product-unavailable"><strong>Este objeto no está disponible para solicitar ahora.</strong><span>Guárdalo en favoritos y vuelve a revisar su disponibilidad.</span></div><SystemActionBar className="product-main-actions"><div className="product-action-price"><span><small>Disponibilidad</small><strong>No disponible</strong></span><span><small>Último precio</small><b>◉ {item.finalPriceVbucks.toLocaleString("es-MX")} paVos</b></span></div><div className="product-action-buttons"><Link className="primary-button" href="/#catalogo">Explorar disponibles</Link><FavoriteButton itemId={item.mainId} itemName={item.name} variant="detail" /></div></SystemActionBar></>}
  </div>;
}

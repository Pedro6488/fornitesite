"use client";

import Link from "next/link";
import type { CatalogItem } from "../domain/catalog-item";
import { canPurchase } from "../domain/catalog-item";
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";
import { useCommerceState } from "@/features/commerce/components/commerce-state-provider";

export function ProductPurchaseActions({ item }: { item: CatalogItem }) {
  const commerce = useCommerceState();
  const purchasable = canPurchase(item);
  const inCart = commerce.cartItemIds.includes(item.mainId);
  return <div className="product-purchase-actions">
    <div className={`product-identity-status ${commerce.validation?.status === "ready" ? "ready" : ""}`}>
      <span aria-hidden="true">{commerce.validation?.status === "ready" ? "✓" : "◎"}</span>
      <div><strong>{commerce.validation?.status === "ready" ? commerce.validation.display_name : "Valida tu ID cuando quieras"}</strong><small>{commerce.validation?.status === "ready" ? "Listo para recibir objetos" : "Será obligatorio antes de confirmar"}</small></div>
      <button type="button" onClick={commerce.openIdentity}>{commerce.validation?.status === "ready" ? "Cambiar" : "Validar"}</button>
    </div>
    {inCart ? <Link className="primary-button" href="/carrito">Revisar carrito</Link> : <AddToCartButton item={item} disabled={!purchasable} />}
  </div>;
}

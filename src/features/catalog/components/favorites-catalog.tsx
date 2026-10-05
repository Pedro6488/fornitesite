"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readFavoriteIds, subscribeToFavorites } from "../application/favorite-storage";
import type { CatalogItem } from "../domain/catalog-item";
import { CatalogCard } from "./catalog-card";
import { useOptionalCommerceState } from "@/features/commerce/components/commerce-state-provider";

export function FavoritesCatalog({ items }: { items: readonly CatalogItem[] }) {
  const commerce = useOptionalCommerceState();
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<string> | null>(null);

  useEffect(() => {
    if (commerce) return;
    const syncFavorites = () => setFavoriteIds(readFavoriteIds());
    const frame = window.requestAnimationFrame(syncFavorites);
    const unsubscribe = subscribeToFavorites(syncFavorites);
    return () => { window.cancelAnimationFrame(frame); unsubscribe(); };
  }, [commerce]);

  const resolvedFavoriteIds = commerce ? commerce.favoriteItemIds : favoriteIds;

  const favorites = useMemo(
    () => resolvedFavoriteIds ? items.filter((item) => resolvedFavoriteIds.has(item.mainId)) : [],
    [resolvedFavoriteIds, items]
  );

  if (resolvedFavoriteIds === null) {
    return <div className="favorites-loading" aria-label="Cargando favoritos" />;
  }

  if (favorites.length === 0) {
    return (
      <div className="favorites-empty">
        <span aria-hidden="true">♡</span>
        <h2>Guarda los objetos que te gustan</h2>
        <p>Usa el corazón de cada tarjeta para reunir aquí tus favoritos.</p>
        <Link href="/#catalogo">Explorar la tienda</Link>
      </div>
    );
  }

  return (
    <>
      <div className="favorites-summary" aria-live="polite">
        <strong>{favorites.length}</strong>
        <span>{favorites.length === 1 ? "objeto guardado" : "objetos guardados"}</span>
      </div>
      <div className="catalog-grid favorites-grid">
        {favorites.map((item, index) => (
          <CatalogCard item={item} index={index} key={item.mainId} initialFavorite />
        ))}
      </div>
    </>
  );
}

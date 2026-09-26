"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readFavoriteIds, subscribeToFavorites } from "../application/favorite-storage";
import type { CatalogItem } from "../domain/catalog-item";
import { CatalogCard } from "./catalog-card";

export function FavoritesCatalog({ items }: { items: readonly CatalogItem[] }) {
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<string> | null>(null);

  useEffect(() => {
    const syncFavorites = () => setFavoriteIds(readFavoriteIds());
    syncFavorites();
    return subscribeToFavorites(syncFavorites);
  }, []);

  const favorites = useMemo(
    () => favoriteIds ? items.filter((item) => favoriteIds.has(item.mainId)) : [],
    [favoriteIds, items]
  );

  if (favoriteIds === null) {
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
          <CatalogCard item={item} index={index} key={item.mainId} />
        ))}
      </div>
    </>
  );
}

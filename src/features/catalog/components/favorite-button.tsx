"use client";

import { useEffect, useState } from "react";
import {
  readFavoriteIds,
  subscribeToFavorites,
  writeFavoriteIds
} from "../application/favorite-storage";

export function FavoriteButton({
  itemId,
  itemName,
  variant = "card"
}: {
  itemId: string;
  itemName: string;
  variant?: "card" | "detail";
}) {
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    const syncFavorite = () => setFavorite(readFavoriteIds().has(itemId));
    syncFavorite();
    return subscribeToFavorites(syncFavorite);
  }, [itemId]);

  function toggleFavorite() {
    const favorites = readFavoriteIds();
    if (favorites.has(itemId)) favorites.delete(itemId);
    else favorites.add(itemId);

    writeFavoriteIds(favorites);
    setFavorite(favorites.has(itemId));
  }

  return (
    <button
      type="button"
      className={`favorite-button favorite-button-${variant} ${favorite ? "active" : ""}`}
      aria-label={favorite ? `Quitar ${itemName} de favoritos` : `Guardar ${itemName} en favoritos`}
      aria-pressed={favorite}
      onClick={toggleFavorite}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" />
      </svg>
      {variant === "detail" && <span>{favorite ? "Guardado" : "Guardar favorito"}</span>}
    </button>
  );
}

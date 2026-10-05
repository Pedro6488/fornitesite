"use client";

import { useEffect, useState } from "react";
import {
  readFavoriteIds,
  subscribeToFavorites,
  writeFavoriteIds
} from "../application/favorite-storage";
import { useOptionalCommerceState } from "@/features/commerce/components/commerce-state-provider";

export function FavoriteButton({
  itemId,
  itemName,
  variant = "card",
  initialFavorite = false
}: {
  itemId: string;
  itemName: string;
  variant?: "card" | "detail";
  initialFavorite?: boolean;
}) {
  const commerce = useOptionalCommerceState();
  const [localFavorite, setLocalFavorite] = useState(initialFavorite);

  useEffect(() => {
    if (commerce) return;
    const syncFavorite = () => setLocalFavorite(readFavoriteIds().has(itemId));
    const frame = window.requestAnimationFrame(syncFavorite);
    const unsubscribe = subscribeToFavorites(syncFavorite);
    return () => { window.cancelAnimationFrame(frame); unsubscribe(); };
  }, [commerce, itemId]);
  const favorite = commerce ? commerce.favoriteItemIds.has(itemId) : localFavorite;

  async function toggleFavorite() {
    if (commerce) {
      await commerce.toggleFavorite(itemId);
      return;
    }
    const favorites = readFavoriteIds();
    if (favorites.has(itemId)) favorites.delete(itemId);
    else favorites.add(itemId);

    writeFavoriteIds(favorites);
    setLocalFavorite(favorites.has(itemId));
  }

  return (
    <button
      type="button"
      className={`favorite-button favorite-button-${variant} ${favorite ? "active" : ""}`}
      aria-label={favorite ? `Quitar ${itemName} de favoritos` : `Guardar ${itemName} en favoritos`}
      aria-pressed={favorite}
      onClick={() => void toggleFavorite()}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" />
      </svg>
      {variant === "detail" && <span>{favorite ? "Guardado" : "Guardar favorito"}</span>}
    </button>
  );
}

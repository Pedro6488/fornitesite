"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import {
  readFavoriteIds,
  subscribeToFavorites,
  writeFavoriteIds,
} from "../application/favorite-storage";
import { useOptionalCommerceState } from "@/features/commerce/components/commerce-state-provider";

export function FavoriteButton({
  itemId,
  itemName,
  variant = "card",
  initialFavorite = false,
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
    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [commerce, itemId]);
  const favorite = commerce
    ? commerce.favoriteItemIds.has(itemId)
    : localFavorite;

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
      aria-label={
        favorite
          ? `Quitar ${itemName} de favoritos`
          : `Guardar ${itemName} en favoritos`
      }
      aria-pressed={favorite}
      onClick={() => void toggleFavorite()}
    >
      <Heart aria-hidden="true" />
    </button>
  );
}

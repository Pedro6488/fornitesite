"use client";

import { useEffect, useState } from "react";

const FAVORITES_STORAGE_KEY = "drop-shop-mx:favorites";
const FAVORITES_CHANGED_EVENT = "drop-shop-mx:favorites-changed";

function readFavorites(): Set<string> {
  try {
    const stored = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const values = stored ? JSON.parse(stored) : [];
    return new Set(Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set();
  }
}

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
    const syncFavorite = () => setFavorite(readFavorites().has(itemId));
    syncFavorite();
    window.addEventListener("storage", syncFavorite);
    window.addEventListener(FAVORITES_CHANGED_EVENT, syncFavorite);
    return () => {
      window.removeEventListener("storage", syncFavorite);
      window.removeEventListener(FAVORITES_CHANGED_EVENT, syncFavorite);
    };
  }, [itemId]);

  function toggleFavorite() {
    const favorites = readFavorites();
    if (favorites.has(itemId)) favorites.delete(itemId);
    else favorites.add(itemId);

    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favorites]));
    setFavorite(favorites.has(itemId));
    window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
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

export const FAVORITES_STORAGE_KEY = "drop-shop-mx:favorites";
export const FAVORITES_CHANGED_EVENT = "drop-shop-mx:favorites-changed";

export function readFavoriteIds(): Set<string> {
  try {
    const stored = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const values: unknown = stored ? JSON.parse(stored) : [];

    return new Set(
      Array.isArray(values)
        ? values.filter((value): value is string => typeof value === "string")
        : []
    );
  } catch {
    return new Set();
  }
}

export function writeFavoriteIds(favorites: ReadonlySet<string>): void {
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favorites]));
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
}

export function subscribeToFavorites(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  window.addEventListener(FAVORITES_CHANGED_EVENT, listener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(FAVORITES_CHANGED_EVENT, listener);
  };
}

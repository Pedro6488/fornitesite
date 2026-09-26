import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { FAVORITES_STORAGE_KEY } from "../application/favorite-storage";
import type { CatalogItem } from "../domain/catalog-item";
import { FavoritesCatalog } from "./favorites-catalog";

const items: CatalogItem[] = [
  {
    mainId: "favorite-item",
    offerId: null,
    name: "Objeto favorito",
    description: "",
    imageUrl: null,
    type: "Outfit",
    rarity: "Epic",
    regularPriceVbucks: 1_500,
    finalPriceVbucks: 1_500,
    priceMxn: 113,
    giftable: false,
    availableUntil: null,
    featured: true
  },
  {
    mainId: "other-item",
    offerId: null,
    name: "Otro objeto",
    description: "",
    imageUrl: null,
    type: "Outfit",
    rarity: "Rare",
    regularPriceVbucks: 800,
    finalPriceVbucks: 800,
    priceMxn: 64,
    giftable: false,
    availableUntil: null,
    featured: false
  }
];

describe("FavoritesCatalog", () => {
  beforeEach(() => window.localStorage.clear());

  it("muestra únicamente los objetos guardados y permite quitarlos", async () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(["favorite-item"]));
    render(<FavoritesCatalog items={items} />);

    expect(await screen.findByText("Objeto favorito")).toBeInTheDocument();
    expect(screen.queryByText("Otro objeto")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Quitar Objeto favorito de favoritos" }));

    await waitFor(() => {
      expect(screen.getByText("Guarda los objetos que te gustan")).toBeInTheDocument();
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogItem } from "../domain/catalog-item";
import { CatalogGrid } from "./catalog-grid";

const item = (overrides: Partial<CatalogItem>): CatalogItem => ({
  mainId: "outfit",
  offerId: null,
  name: "Exploradora estelar",
  description: "Atuendo reactivo",
  imageUrl: null,
  type: "Outfit",
  rarity: "Epic",
  regularPriceVbucks: 1_500,
  finalPriceVbucks: 1_500,
  priceMxn: 113,
  giftable: false,
  availableUntil: null,
  featured: false,
  ...overrides
});

class IntersectionObserverMock {
  observe() {}
  disconnect() {}
}

describe("CatalogGrid", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  });

  it("filtra el catálogo con una búsqueda fácil", async () => {
    render(<CatalogGrid items={[
      item({}),
      item({ mainId: "pickaxe", name: "Pico solar", type: "Pickaxe" })
    ]} />);

    fireEvent.change(screen.getByLabelText("Buscar en la tienda"), {
      target: { value: "solar" }
    });

    await waitFor(() => expect(screen.getByText("Pico solar")).toBeInTheDocument());
    expect(screen.queryByText("Exploradora estelar")).not.toBeInTheDocument();
    expect(screen.getByText("resultado")).toBeInTheDocument();
  });

  it("permite explorar por categoría", async () => {
    render(<CatalogGrid items={[
      item({}),
      item({ mainId: "pickaxe", name: "Pico solar", type: "Pickaxe" })
    ]} />);

    fireEvent.click(screen.getByRole("button", { name: /Picos/ }));

    await waitFor(() => expect(screen.queryByText("Exploradora estelar")).not.toBeInTheDocument());
    expect(screen.getByText("Pico solar")).toBeInTheDocument();
  });
});

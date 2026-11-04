import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogItem } from "../domain/catalog-item";
import { CatalogHero } from "./catalog-hero";

const item = (index: number): CatalogItem => ({
  mainId: `offer/${index}`,
  offerId: `offer-${index}`,
  name: `Objeto destacado ${index}`,
  description: "Objeto destacado",
  imageUrl: `https://example.com/item-${index}.png`,
  type: "Outfit",
  rarity: "Epic",
  regularPriceVbucks: 1_500 + index,
  finalPriceVbucks: 1_500 + index,
  priceMxn: 113 + index,
  giftable: true,
  availableUntil: null,
  featured: true,
  collaboration: `Colección ${index}`,
  shopInDate: "2026-09-26T00:00:00Z",
  shopLayoutRank: index
});

describe("CatalogHero", () => {
  afterEach(() => vi.useRealTimers());

  it("rota los destacados y deja fijo el que la persona elige", () => {
    vi.useFakeTimers();
    render(<CatalogHero items={[item(1), item(2), item(3)]} />);
    expect(screen.getByRole("link", { name: /Ver Objeto destacado 3/ })).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(6_000); });
    expect(screen.getByRole("link", { name: /Ver Objeto destacado 2/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mostrar Objeto destacado 1" }));
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.getByRole("link", { name: /Ver Objeto destacado 1/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pausar/ })).not.toBeInTheDocument();
  });

  it("no incluye música en los destacados", () => {
    render(<CatalogHero items={[item(1), { ...item(9), name: "Everlong", type: "Pista de improvisación" }]} />);

    expect(screen.queryByRole("link", { name: /Ver Everlong/ })).not.toBeInTheDocument();
  });

  it("convierte lo más nuevo en enlaces con precio en paVos y MXN", () => {
    const newestItems = Array.from({ length: 7 }, (_, index) => item(index));
    const olderItem = { ...item(99), shopInDate: "2026-09-25T00:00:00Z" };
    render(<CatalogHero items={[olderItem, ...newestItems]} />);

    const featuredLink = screen.getByRole("link", {
      name: /Ver Objeto destacado 6, 1,506 paVos/
    });

    expect(featuredLink).toHaveAttribute("href", "/objetos/offer%2F6");
    expect(featuredLink).toHaveTextContent("Objeto destacado 6");
    expect(featuredLink).toHaveTextContent("1,506");
    expect(featuredLink).toHaveTextContent("$119");
    expect(screen.queryByText("Objeto destacado 99")).not.toBeInTheDocument();
  });
});

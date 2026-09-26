import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

let intersectionCallback: IntersectionObserverCallback;

class IntersectionObserverMock {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }

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

  it("muestra primero una colaboración recién llegada y permite encontrarla por colección", async () => {
    render(<CatalogGrid items={[
      item({
        mainId: "bloons",
        name: "Dart Monkey",
        collaboration: "Bloons TD",
        shopInDate: "2026-09-25T00:00:00Z",
        shopLayoutIndex: 1
      }),
      item({
        mainId: "leon",
        name: "Leon S. Kennedy",
        collaboration: "Resident Evil",
        shopInDate: "2026-09-26T00:00:00Z",
        shopLayoutIndex: 9
      })
    ]} />);

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings[0]).toHaveTextContent("Resident Evil");
    fireEvent.click(screen.getByRole("tab", { name: /Colecciones/ }));
    fireEvent.change(screen.getByLabelText("Buscar en la tienda"), { target: { value: "resident" } });
    fireEvent.click(screen.getByRole("button", { name: /Abrir Resident Evil, 1 objeto/ }));

    await waitFor(() => expect(screen.queryByText("Dart Monkey")).not.toBeInTheDocument());
    expect(screen.getByText("Leon S. Kennedy")).toBeInTheDocument();
    expect(screen.getByLabelText("Ordenar")).toHaveValue("newest");
  });

  it("cambia de novedades a popular con resultados realmente distintos", async () => {
    const items = Array.from({ length: 7 }, (_, index) => item({
      mainId: `mode-${index}`,
      name: `Modo ${index}`,
      collaboration: `Colección ${index}`,
      shopInDate: index === 6 ? "2026-09-26T00:00:00Z" : "2026-09-25T00:00:00Z",
      shopLayoutRank: index
    }));
    render(<CatalogGrid items={items} />);

    expect(screen.getByText("Modo 6")).toBeInTheDocument();
    expect(screen.queryByText("Modo 5")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Popular ahora/ }));

    await waitFor(() => expect(screen.getByText("Modo 5")).toBeInTheDocument());
    expect(screen.queryByText("Modo 0")).not.toBeInTheDocument();
  });

  it("combina filtros de colección, precio y disponibilidad y los muestra como activos", async () => {
    render(<CatalogGrid items={[
      item({
        mainId: "resident",
        name: "Leon S. Kennedy",
        collaboration: "Resident Evil",
        priceMxn: 75,
        offerId: "offer",
        giftable: true
      }),
      item({
        mainId: "disney",
        name: "Alien",
        collaboration: "Disney",
        priceMxn: 170
      })
    ]} />);

    fireEvent.click(screen.getByRole("tab", { name: /Colecciones/ }));
    fireEvent.click(screen.getByRole("button", { name: /Abrir Resident Evil, 1 objeto/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    expect(screen.getByRole("dialog", { name: "Filtrar catálogo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hasta $80" }));
    fireEvent.click(screen.getByRole("button", { name: "Listos para comprar" }));
    fireEvent.click(screen.getByRole("button", { name: /Ver 1 resultado/ }));

    await waitFor(() => expect(screen.queryByText("Alien")).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Leon S. Kennedy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resident Evil ×" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Listos para comprar ×" })).toBeInTheDocument();
  });

  it("mantiene los filtros secundarios ocultos hasta que el usuario los solicita", () => {
    render(<CatalogGrid items={[item({})]} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    expect(screen.getByRole("dialog", { name: "Filtrar catálogo" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Cerrar filtros" })[1]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("agrega más objetos sin reemplazar las tarjetas ya visibles", async () => {
    const items = Array.from({ length: 49 }, (_, index) => item({
      mainId: `item-${index}`,
      name: `Objeto ${index}`
    }));
    render(<CatalogGrid items={items} />);
    const firstCard = screen.getByText("Objeto 0").closest("article");

    act(() => {
      intersectionCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    await waitFor(() => expect(screen.getByText("Objeto 48")).toBeInTheDocument());
    expect(screen.getByText("Objeto 0").closest("article")).toBe(firstCard);
  });
});

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
    window.history.replaceState(null, "", "/fortnite");
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
    fireEvent.click(screen.getByRole("button", { name: /Colecciones/ }));
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

    fireEvent.click(screen.getByRole("button", { name: /Novedades/ }));

    expect(screen.getByText("Modo 6")).toBeInTheDocument();
    expect(screen.queryByText("Modo 5")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Populares/ }));

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

    fireEvent.click(screen.getByRole("button", { name: /Colecciones/ }));
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

  it("muestra una vista previa por colección y permite abrirla completa", async () => {
    const items = Array.from({ length: 14 }, (_, index) => item({
      mainId: `peak-${index}`,
      name: `Objeto ${String(index).padStart(2, "0")}`,
      collaboration: "Estilo de élite"
    }));
    render(<CatalogGrid items={items} />);

    expect(screen.getByText("Objeto 09")).toBeInTheDocument();
    expect(screen.queryByText("Objeto 10")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver los 14 objetos de Estilo de élite" }));

    await waitFor(() => expect(screen.getByText("Objeto 13")).toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 2, name: "Estilo de élite" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Estilo de élite ×" })).toBeInTheDocument();
  });

  it("deja las pistas de música al final aunque sean las más nuevas", () => {
    render(<CatalogGrid items={[
      item({ mainId: "track", name: "Everlong", type: "Pista de improvisación", collaboration: "Pistas de improvisación", shopInDate: "2026-09-27T00:00:00Z" }),
      item({ mainId: "outfit", name: "Harley Quinn", collaboration: "DC", shopInDate: "2026-09-20T00:00:00Z" })
    ]} />);

    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings.indexOf("DC")).toBeLessThan(headings.indexOf("Pistas de improvisación"));
  });

  it("ordena de verdad por precio, sin separar por colección", async () => {
    render(<CatalogGrid items={[
      item({ mainId: "caro", name: "Caro", collaboration: "Colección A", finalPriceVbucks: 2_000 }),
      item({ mainId: "medio", name: "Medio", collaboration: "Colección B", finalPriceVbucks: 1_000 }),
      item({ mainId: "barato", name: "Barato", collaboration: "Colección A", finalPriceVbucks: 500 })
    ]} />);

    fireEvent.change(screen.getByLabelText("Ordenar"), { target: { value: "price-asc" } });

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Colección A" })).not.toBeInTheDocument());
    const names = screen.getAllByRole("article").map((card) => card.querySelector("h2")?.textContent);
    expect(names).toEqual(["Barato", "Medio", "Caro"]);
  });

  it("actualiza los conteos de categoría según lo que se busca", async () => {
    render(<CatalogGrid items={[
      item({ mainId: "a", name: "Solar", type: "Outfit" }),
      item({ mainId: "b", name: "Solar", type: "Pickaxe" }),
      item({ mainId: "c", name: "Lunar", type: "Pickaxe" }),
      item({ mainId: "d", name: "Lunar", type: "Emote" })
    ]} />);

    expect(screen.getByRole("button", { name: /Gestos/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar en la tienda"), { target: { value: "solar" } });

    await waitFor(() => expect(screen.queryByRole("button", { name: /Gestos/ })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Picos/ })).toHaveTextContent("1");
  });

  it("explica una búsqueda sin resultados y permite salir de ella", async () => {
    render(<CatalogGrid items={[item({})]} />);

    fireEvent.change(screen.getByLabelText("Buscar en la tienda"), { target: { value: "asd" } });

    await waitFor(() => expect(screen.getByRole("heading", { name: "No encontramos “asd”" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Ver todo el catálogo" }));
    await waitFor(() => expect(screen.getByText("Exploradora estelar")).toBeInTheDocument());
  });

  it("restaura los filtros de la URL al volver de un objeto", async () => {
    window.history.replaceState(null, "", "/fortnite?categoria=Picos&q=solar");
    render(<CatalogGrid items={[
      item({ mainId: "a", name: "Exploradora solar" }),
      item({ mainId: "b", name: "Pico solar", type: "Pickaxe" }),
      item({ mainId: "c", name: "Pico lunar", type: "Pickaxe" })
    ]} />);

    await waitFor(() => expect(screen.getByLabelText("Buscar en la tienda")).toHaveValue("solar"));
    expect(screen.getByText("Pico solar")).toBeInTheDocument();
    expect(screen.queryByText("Exploradora solar")).not.toBeInTheDocument();
    expect(screen.queryByText("Pico lunar")).not.toBeInTheDocument();
  });

  it("guarda los filtros en la URL conservando el ancla", async () => {
    window.history.replaceState(null, "", "/fortnite#catalogo");
    render(<CatalogGrid items={[item({ mainId: "b", name: "Pico solar", type: "Pickaxe" }), item({})]} />);

    fireEvent.click(screen.getByRole("button", { name: /Picos/ }));

    await waitFor(() => expect(window.location.search).toBe("?categoria=Picos"));
    expect(window.location.hash).toBe("#catalogo");
  });

  it("devuelve el foco al botón de filtros al cerrar el panel", () => {
    render(<CatalogGrid items={[item({})]} />);
    const toggle = screen.getByRole("button", { name: "Filtros" });

    fireEvent.click(toggle);
    expect(screen.getAllByRole("button", { name: "Cerrar filtros" })[1]).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(toggle).toHaveFocus();
  });
});

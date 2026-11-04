import { describe, expect, it } from "vitest";
import { CATALOG_PAGE_SIZE, parseCatalogUrlState, serializeCatalogUrlState } from "./catalog-url-state";

describe("estado del catálogo en la URL", () => {
  it("deja la URL limpia cuando no hay nada aplicado", () => {
    expect(serializeCatalogUrlState(parseCatalogUrlState(""))).toBe("");
  });

  it("conserva búsqueda, filtros y avance al ir y volver", () => {
    const state = parseCatalogUrlState("?q=pico+solar&categoria=Picos&orden=price-asc&precio=under-80&disponibilidad=available&rareza=Raro&mostrar=96");

    expect(state).toMatchObject({
      query: "pico solar",
      category: "Picos",
      sort: "price-asc",
      priceRange: "under-80",
      availability: "available",
      rarity: "Raro",
      visibleCount: 96
    });
    expect(parseCatalogUrlState(serializeCatalogUrlState(state))).toEqual(state);
  });

  it("no escribe en la URL el orden que ya es el predeterminado de la vista", () => {
    const popular = parseCatalogUrlState("?vista=populares");

    expect(popular).toMatchObject({ mode: "popular", sort: "featured" });
    expect(serializeCatalogUrlState(popular)).toBe("?vista=populares");
  });

  it("en colecciones solo conserva la vista y la búsqueda", () => {
    const state = parseCatalogUrlState("?vista=colecciones&q=dc&categoria=Picos");

    expect(state.view).toBe("collections");
    expect(serializeCatalogUrlState(state)).toBe("?vista=colecciones&q=dc");
  });

  it("ignora valores que no existen en una URL manipulada", () => {
    expect(parseCatalogUrlState("?categoria=Hack&orden=drop&precio=gratis&disponibilidad=x&mostrar=-5&vista=otra")).toMatchObject({
      view: "items",
      mode: "all",
      category: "Todos",
      sort: "newest",
      priceRange: "all",
      availability: "all",
      visibleCount: CATALOG_PAGE_SIZE
    });
    expect(parseCatalogUrlState("?mostrar=999999").visibleCount).toBe(2_000);
  });
});

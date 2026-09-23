import type { CatalogItem, CatalogProvider } from "../domain/catalog-item";

const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();

const demoItems: readonly CatalogItem[] = [
  {
    mainId: "CID_DROP_NOVA",
    offerId: "demo-offer-nova",
    name: "Nova nocturna",
    description: "Atuendo reactivo con estilos alternativos.",
    imageUrl: null,
    type: "Atuendo",
    rarity: "Épico",
    regularPriceVbucks: 2_000,
    finalPriceVbucks: 1_500,
    priceMxn: null,
    giftable: true,
    availableUntil: tomorrow(),
    featured: true
  },
  {
    mainId: "EID_DROP_PULSE",
    offerId: "demo-offer-pulse",
    name: "Pulso perfecto",
    description: "Un gesto sincronizado para celebrar.",
    imageUrl: null,
    type: "Gesto",
    rarity: "Raro",
    regularPriceVbucks: 500,
    finalPriceVbucks: 500,
    priceMxn: null,
    giftable: true,
    availableUntil: tomorrow(),
    featured: false
  },
  {
    mainId: "BID_DROP_RUSH",
    offerId: "demo-offer-rush",
    name: "Lote Impacto",
    description: "Atuendo, mochila y pico en una sola oferta.",
    imageUrl: null,
    type: "Lote",
    rarity: "Serie Leyendas",
    regularPriceVbucks: 3_200,
    finalPriceVbucks: 2_300,
    priceMxn: null,
    giftable: true,
    availableUntil: tomorrow(),
    featured: false
  },
  {
    mainId: "SPID_DROP_GLOW",
    offerId: "demo-offer-glow",
    name: "Brillo orbital",
    description: "Envoltorio animado para tu equipamiento.",
    imageUrl: null,
    type: "Envoltorio",
    rarity: "Poco común",
    regularPriceVbucks: 300,
    finalPriceVbucks: 300,
    priceMxn: null,
    giftable: true,
    availableUntil: tomorrow(),
    featured: false
  }
];

export class DemoCatalogProvider implements CatalogProvider {
  async getCurrentCatalog(): Promise<readonly CatalogItem[]> {
    return demoItems;
  }
}

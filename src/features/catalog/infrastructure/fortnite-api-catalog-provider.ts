import type { CatalogItem, CatalogProvider } from "../domain/catalog-item";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function integer(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}

function optionalInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

export class FortniteApiCatalogProvider implements CatalogProvider {
  constructor(private readonly baseUrl: string) {}

  async getCurrentCatalog(): Promise<readonly CatalogItem[]> {
    const response = await fetch(`${this.baseUrl}/shop`, { next: { revalidate: 300 } });
    if (!response.ok) throw new Error(`Fortnite-API respondió ${response.status}.`);
    const payload = record(await response.json());
    const data = record(payload.data);
    const entries = Array.isArray(data.entries) ? data.entries : [];

    return entries.flatMap((rawEntry, index): CatalogItem[] => {
      const entry = record(rawEntry);
      const brItems = Array.isArray(entry.brItems) ? entry.brItems : [];
      const first = record(brItems[0]);
      const bundle = record(entry.bundle);
      const layout = record(entry.layout);
      const images = record(first.images);
      const rarity = record(first.rarity);
      const type = record(first.type);
      const finalPrice = integer(entry.finalPrice || entry.price);
      const offerId = text(entry.offerId);
      const bundleName = text(bundle.name);
      const bundleImage = text(bundle.image);
      const isBundle = Boolean(bundleName || bundleImage);
      // Fortnite-API no siempre entrega bundle.id. Usar el primer brItem en ese
      // caso hace que el lote colisione con la oferta individual y se descarte.
      const mainId = isBundle
        ? text(bundle.id, offerId || `bundle-offer-${index}`)
        : text(first.id, offerId || `offer-${index}`);
      if (!mainId || !finalPrice) return [];

      return [{
        mainId,
        offerId: offerId || null,
        name: bundleName || text(first.name, "Objeto sin nombre"),
        description: text(bundle.info, text(first.description)),
        imageUrl: bundleImage || text(images.featured, text(images.icon)) || null,
        type: isBundle ? "Lote" : text(type.displayValue, "Objeto"),
        rarity: text(rarity.displayValue, "Común"),
        regularPriceVbucks: integer(entry.regularPrice) || finalPrice,
        finalPriceVbucks: finalPrice,
        priceMxn: null,
        giftable: Boolean(entry.giftable ?? true),
        availableUntil: text(entry.outDate) || null,
        featured: index === 0,
        collaboration: text(layout.name) || null,
        shopInDate: text(entry.inDate) || null,
        shopLayoutIndex: optionalInteger(layout.index),
        shopLayoutRank: optionalInteger(layout.rank)
      }];
    });
  }
}

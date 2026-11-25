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

function metadata(layout: UnknownRecord, kind: string, key: string): string {
  const entries = Array.isArray(layout[kind]) ? layout[kind] : [];
  return text(record(entries.find((value) => record(value).key === key)).value);
}

function cosmeticIds(entry: UnknownRecord): string[] {
  return ["brItems", "tracks", "cars", "instruments"].flatMap((key) =>
    Array.isArray(entry[key]) ? entry[key].map((item) => text(record(item).id)).filter(Boolean) : []);
}

/** Algunos lotes pierden bundle/layout metadata. Solo inferirlos si una oferta
 * individual más barata contiene un subconjunto de sus objetos y comparte personaje.
 * No basta el nombre del asset: también los picos con estilos usan "Bundle".
 */
function isUnlabelledBundle(entry: UnknownRecord, entries: readonly unknown[]): boolean {
  if (!/bundle/i.test(`${text(entry.displayAssetPath)} ${text(entry.newDisplayAssetPath)}`)) return false;
  const first = record(Array.isArray(entry.brItems) ? entry.brItems[0] : null);
  if (text(record(first.type).value) !== "outfit") return false;
  const ids = new Set(cosmeticIds(entry));
  const price = integer(entry.finalPrice || entry.price);
  return entries.some((raw) => {
    const other = record(raw);
    const otherFirst = record(Array.isArray(other.brItems) ? other.brItems[0] : null);
    const otherPrice = integer(other.finalPrice || other.price);
    const otherIds = cosmeticIds(other);
    return other !== entry && text(otherFirst.id) === text(first.id)
      && otherPrice > 0 && otherPrice < price && otherIds.length > 0
      && otherIds.length < ids.size && otherIds.every((id) => ids.has(id));
  });
}

/** La API traduce casi todo con `language`, salvo estos textos fijos. "Bundle" no describe nada: el tipo ya dice "Lote". */
function bundleDescription(info: string): string {
  return /^bundle$/i.test(info.trim()) ? "" : info;
}

function rarityLabel(value: string): string {
  return value.trim() === "SERIE DE DC" ? "Serie de DC" : value.trim();
}

function jamTrackDescription(track: UnknownRecord): string {
  const artist = text(track.artist);
  const album = text(track.album);
  return [artist, album].filter(Boolean).join(" · ");
}

export class FortniteApiCatalogProvider implements CatalogProvider {
  constructor(private readonly baseUrl: string) {}

  async getCurrentCatalog(): Promise<readonly CatalogItem[]> {
    const response = await fetch(`${this.baseUrl}/shop?language=es-419`, { next: { revalidate: 300 } });
    if (!response.ok) throw new Error(`Fortnite-API respondió ${response.status}.`);
    const payload = record(await response.json());
    const data = record(payload.data);
    const entries = Array.isArray(data.entries) ? data.entries : [];

    return entries.flatMap((rawEntry, index): CatalogItem[] => {
      const entry = record(rawEntry);
      const brItems = Array.isArray(entry.brItems) ? entry.brItems : [];
      const tracks = Array.isArray(entry.tracks) ? entry.tracks : [];
      const cars = Array.isArray(entry.cars) ? entry.cars : [];
      const instruments = Array.isArray(entry.instruments) ? entry.instruments : [];
      const first = record(brItems[0] ?? cars[0] ?? instruments[0]);
      const track = record(tracks[0]);
      const bundle = record(entry.bundle);
      const layout = record(entry.layout);
      const displayAsset = record(entry.newDisplayAsset);
      const images = record(first.images);
      const rarity = record(first.rarity);
      const type = record(first.type);
      const finalPrice = integer(entry.finalPrice || entry.price);
      const offerId = text(entry.offerId);
      // Las ofertas billboard describen el lote en layout, sin entry.bundle.
      // No basta contar objetos: un atuendo puede incluir su mochila gratis.
      const layoutBundle = /\b(lote|bundle)\b/i.test(metadata(layout, "textMetadata", "subtitle"));
      const inferredBundle = !text(bundle.name) && !layoutBundle && isUnlabelledBundle(entry, entries);
      const bundleName = text(bundle.name) || (layoutBundle ? metadata(layout, "textMetadata", "title") : "")
        || (inferredBundle ? `Lote ${text(first.name)}` : "");
      const bodyImage = layoutBundle ? metadata(layout, "textureMetadata", "bodyImage") : "";
      const characterImage = layoutBundle ? metadata(layout, "textureMetadata", "foreground") : "";
      // bodyImage sólo contiene los accesorios; foreground contiene el personaje.
      const layoutImage = bodyImage && characterImage
        ? `/api/catalog/bundle-image?${new URLSearchParams({ character: characterImage, items: bodyImage })}`
        : characterImage || bodyImage;
      const bundleImage = text(bundle.image) || layoutImage;
      const isBundle = Boolean(bundleName || bundleImage || layoutBundle);
      const isIndividualJamTrack = !isBundle && tracks.length === 1 && !brItems.length && !cars.length && !instruments.length;
      const renderImages = Array.isArray(displayAsset.renderImages) ? displayAsset.renderImages : [];
      const renderImage = record(renderImages[0]);
      const renderImageUrl = text(renderImage.image);
      const cosmoFileName = text(renderImage.fileName);
      const cosmoId = /^cosmo__(.+)\.png$/i.exec(cosmoFileName)?.[1] ?? null;
      // Fortnite-API no siempre entrega bundle.id. Usar el primer brItem en ese
      // caso hace que el lote colisione con la oferta individual y se descarte.
      const mainId = isBundle
        ? text(bundle.id) || offerId || `bundle-offer-${index}`
        : isIndividualJamTrack
          ? text(track.id, offerId || `track-offer-${index}`)
          : text(first.id, offerId || `offer-${index}`);
      if (!mainId || !finalPrice) return [];

      return [{
        mainId,
        offerId: offerId || null,
        name: bundleName || (isIndividualJamTrack ? text(track.title, "Objeto sin nombre") : text(first.name, "Objeto sin nombre")),
        description: inferredBundle
          ? `Incluye: ${[...new Set([...brItems, ...instruments, ...cars].map((item) => text(record(item).name)).concat(tracks.map((item) => text(record(item).title))).filter(Boolean))].join(", ")}.`
          : bundleDescription(text(bundle.info, isIndividualJamTrack ? jamTrackDescription(track) : text(first.description))),
        imageUrl: bundleImage || (isIndividualJamTrack ? text(track.albumArt) : text(images.featured) || text(images.icon) || text(images.large) || text(images.small)) || renderImageUrl || null,
        type: isBundle ? "Lote" : isIndividualJamTrack ? "Pista de improvisación" : text(type.displayValue, "Objeto"),
        rarity: rarityLabel(text(rarity.displayValue, "Común")),
        regularPriceVbucks: integer(entry.regularPrice) || finalPrice,
        finalPriceVbucks: finalPrice,
        priceMxn: null,
        giftable: Boolean(entry.giftable ?? true),
        availableUntil: text(entry.outDate) || null,
        featured: index === 0,
        collaboration: text(layout.name) || null,
        // Algunas respuestas del catálogo incluyen el enlace canónico de Fortnite.
        // Se conserva para resolver la previsualización sólo al abrir el detalle.
        officialUrl: text(entry.webURL, text(entry.webUrl, text(entry.itemShopUrl))) || null,
        cosmoId,
        shopInDate: text(entry.inDate) || null,
        shopLayoutIndex: optionalInteger(layout.index),
        shopLayoutRank: optionalInteger(layout.rank)
      }];
    });
  }
}

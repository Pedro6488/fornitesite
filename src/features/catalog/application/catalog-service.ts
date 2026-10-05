import { calculateMxnPrice, UnsupportedVbucksPriceError } from "@/features/pricing/domain/price-calculator";
import type { CatalogPricingProvider } from "@/features/pricing/infrastructure/supabase-pricing-provider";
import { isCatalogItemDisplayable, type CatalogItem, type CatalogProvider } from "../domain/catalog-item";

export class CatalogService {
  constructor(
    private readonly visualCatalog: CatalogProvider,
    private readonly transactionalCatalog?: CatalogProvider,
    private readonly pricing?: CatalogPricingProvider
  ) {}

  async list(): Promise<readonly CatalogItem[]> {
    const visualItems = await this.visualCatalog.getCurrentCatalog();
    const transactionalItems = this.transactionalCatalog
      ? await this.transactionalCatalog.getCurrentCatalog()
      : [];
    const transactionById = new Map(transactionalItems.map((item) => [item.mainId, item]));
    const hasTransactionalCatalog = Boolean(this.transactionalCatalog);

    const displayableItems = visualItems.filter(isCatalogItemDisplayable);
    const authoritativePrices = this.pricing ? await this.pricing.price(displayableItems) : null;
    const enrichedItems = displayableItems.map((item) => {
      const transaction = transactionById.get(item.mainId);
      let priceMxn: number | null = authoritativePrices?.get(item.mainId) ?? null;

      if (!authoritativePrices) {
        try {
          priceMxn = calculateMxnPrice(item.finalPriceVbucks);
        } catch (error) {
          if (!(error instanceof UnsupportedVbucksPriceError)) throw error;
        }
      }

      return {
        ...item,
        offerId: hasTransactionalCatalog ? transaction?.offerId ?? null : item.offerId,
        giftable: hasTransactionalCatalog ? Boolean(transaction?.giftable) : item.giftable,
        availableUntil: transaction?.availableUntil ?? item.availableUntil,
        priceMxn
      };
    });

    const uniqueItems = new Map<string, CatalogItem>();
    for (const item of enrichedItems) {
      if (!uniqueItems.has(item.mainId)) uniqueItems.set(item.mainId, item);
    }

    return [...uniqueItems.values()];
  }

  async find(mainId: string): Promise<CatalogItem | null> {
    const items = await this.list();
    return items.find((item) => item.mainId === mainId) ?? null;
  }
}

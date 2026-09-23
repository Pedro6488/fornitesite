import { calculateMxnPrice, UnsupportedVbucksPriceError } from "@/features/pricing/domain/price-calculator";
import type { CatalogItem, CatalogProvider } from "../domain/catalog-item";

export class CatalogService {
  constructor(
    private readonly visualCatalog: CatalogProvider,
    private readonly transactionalCatalog?: CatalogProvider
  ) {}

  async list(): Promise<readonly CatalogItem[]> {
    const visualItems = await this.visualCatalog.getCurrentCatalog();
    const transactionalItems = this.transactionalCatalog
      ? await this.transactionalCatalog.getCurrentCatalog()
      : visualItems;
    const transactionById = new Map(transactionalItems.map((item) => [item.mainId, item]));

    return visualItems.map((item) => {
      const transaction = transactionById.get(item.mainId);
      let priceMxn: number | null = null;

      try {
        priceMxn = calculateMxnPrice(item.finalPriceVbucks);
      } catch (error) {
        if (!(error instanceof UnsupportedVbucksPriceError)) throw error;
      }

      return {
        ...item,
        offerId: transaction?.offerId ?? null,
        giftable: Boolean(transaction?.giftable),
        availableUntil: transaction?.availableUntil ?? item.availableUntil,
        priceMxn
      };
    });
  }

  async find(mainId: string): Promise<CatalogItem | null> {
    const items = await this.list();
    return items.find((item) => item.mainId === mainId) ?? null;
  }
}

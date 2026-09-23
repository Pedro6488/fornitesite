import { canPurchase } from "@/features/catalog/domain/catalog-item";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import type { OrderRepository, PaymentMethod } from "../domain/order";

export class CreateOrder {
  constructor(private readonly catalog: { find(mainId: string): Promise<CatalogItem | null> }, private readonly orders: OrderRepository) {}

  async execute(input: { itemMainId: string; customerEmail: string; epicAccountId: string; epicDisplayName: string; paymentMethod: PaymentMethod }) {
    const item = await this.catalog.find(input.itemMainId);
    if (!item || !canPurchase(item) || item.priceMxn === null || !item.offerId) throw new Error("La oferta ya no está disponible para compra.");
    return this.orders.create({ status: "draft", customerEmail: input.customerEmail, epicAccountId: input.epicAccountId,
      epicDisplayName: input.epicDisplayName, itemMainId: item.mainId, offerId: item.offerId, itemName: item.name,
      itemImageUrl: item.imageUrl, vbucksPrice: item.finalPriceVbucks, amountMxnCents: item.priceMxn * 100,
      paymentMethod: input.paymentMethod });
  }
}

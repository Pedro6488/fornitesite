import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import type { OrderRepository } from "../domain/order";
import { CreateOrder } from "./create-order";

const item: CatalogItem = { mainId: "item", offerId: "offer", name: "Objeto", description: "", imageUrl: null, type: "Atuendo", rarity: "Raro", regularPriceVbucks: 1_500, finalPriceVbucks: 1_500, priceMxn: 113, giftable: true, availableUntil: null, featured: false };
const catalog = (value: CatalogItem | null) => ({ find: async () => value });
const repository: OrderRepository = {
  create: async (input) => ({ ...input, id: "order", publicToken: "token", createdAt: new Date(0).toISOString() }),
  findById: async () => null, findByPublicToken: async () => null,
  transition: async () => true
};

describe("CreateOrder", () => {
  it("congela el producto y el precio en centavos", async () => {
    const order = await new CreateOrder(catalog(item), repository).execute({ itemMainId: "item", customerEmail: "a@example.com", epicAccountId: "epic", epicDisplayName: "Player", paymentMethod: "mercado_pago" });
    expect(order).toEqual(expect.objectContaining({ offerId: "offer", amountMxnCents: 11_300, status: "draft" }));
  });
  it("rechaza ofertas inexistentes", async () => {
    await expect(new CreateOrder(catalog(null), repository).execute({ itemMainId: "missing", customerEmail: "a@example.com", epicAccountId: "epic", epicDisplayName: "Player", paymentMethod: "bank_transfer" })).rejects.toThrow("ya no está disponible");
  });
});

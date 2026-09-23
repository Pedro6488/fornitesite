import { CatalogService } from "../application/catalog-service";
import { DemoCatalogProvider } from "../infrastructure/demo-catalog-provider";
import { FnShopCatalogProvider } from "../infrastructure/fnshop-catalog-provider";
import { FortniteApiCatalogProvider } from "../infrastructure/fortnite-api-catalog-provider";

export async function getCatalogService(): Promise<CatalogService> {
  const fnShopKey = process.env.FNSHOP_API_KEY;
  const fortniteBaseUrl = process.env.FORTNITE_API_BASE_URL;

  if (!fnShopKey || !fortniteBaseUrl) {
    const demo = new DemoCatalogProvider();
    return new CatalogService(demo, demo);
  }

  return new CatalogService(
    new FortniteApiCatalogProvider(fortniteBaseUrl),
    new FnShopCatalogProvider(
      process.env.FNSHOP_API_BASE_URL ?? "https://fnitem.shop/api/v3/service",
      fnShopKey
    )
  );
}

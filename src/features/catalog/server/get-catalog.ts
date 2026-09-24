import { CatalogService } from "../application/catalog-service";
import { FnShopCatalogProvider } from "../infrastructure/fnshop-catalog-provider";
import { FortniteApiCatalogProvider } from "../infrastructure/fortnite-api-catalog-provider";

const DEFAULT_FORTNITE_API_URL = "https://fortnite-api.com/v2";
const DEFAULT_FNSHOP_API_URL = "https://fnitem.shop/api/v3/service";

type CatalogConfiguration = Readonly<{
  fortniteBaseUrl?: string;
  fnShopBaseUrl?: string;
  fnShopApiKey?: string;
}>;

export function createCatalogService(configuration: CatalogConfiguration): CatalogService {
  const visualCatalog = new FortniteApiCatalogProvider(
    configuration.fortniteBaseUrl || DEFAULT_FORTNITE_API_URL
  );
  const transactionalCatalog = configuration.fnShopApiKey
    ? new FnShopCatalogProvider(
        configuration.fnShopBaseUrl || DEFAULT_FNSHOP_API_URL,
        configuration.fnShopApiKey
      )
    : undefined;

  return new CatalogService(visualCatalog, transactionalCatalog);
}

export async function getCatalogService(): Promise<CatalogService> {
  return createCatalogService({
    fortniteBaseUrl: process.env.FORTNITE_API_BASE_URL,
    fnShopBaseUrl: process.env.FNSHOP_API_BASE_URL,
    fnShopApiKey: process.env.FNSHOP_API_KEY
  });
}
